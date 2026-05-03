import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getStockRanking, getStockKline } from "@/lib/market-api"
import { screenByStrategy, aiScoreScreenResults, type ScreenMatch } from "@/lib/ai/stock-screener"
import dayjs from "dayjs"

export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { strategy } = await request.json()

  if (!strategy) {
    return NextResponse.json({ error: "请选择筛选策略" }, { status: 400 })
  }

  // Get top stocks by turnover rate as candidates
  const rawCandidates = await getStockRanking("f8", 100, false)
  const candidates = rawCandidates.filter((s) => s.price > 0)

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "无法获取股票数据，可能非交易时间" },
      { status: 400 }
    )
  }

  // Screen each candidate with kline data
  const matches: ScreenMatch[] = []
  const batchSize = 10

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize)
    const klinePromises = batch.map((stock) => getStockKline(stock.code, "daily", 120))
    const klineResults = await Promise.all(klinePromises)

    klineResults.forEach((klines, idx) => {
      const stock = batch[idx]
      const result = screenByStrategy(klines, strategy)

      if (result.matched) {
        matches.push({
          code: stock.code,
          name: stock.name,
          price: stock.price,
          changePercent: stock.changePercent,
          reason: result.reason,
          indicators: result.indicators,
        })
      }
    })

    // Stop if we have enough matches
    if (matches.length >= 20) break
  }

  // AI scoring
  const scored = matches.length > 0 ? await aiScoreScreenResults(matches) : []

  // Save results to database
  const today = dayjs().startOf("day").toDate()

  if (scored.length > 0) {
    await prisma.screenResult.createMany({
      data: scored.map((match) => ({
        strategyName: strategy,
        stockCode: match.code,
        stockName: match.name,
        matchDate: today,
        score: typeof match.indicators.aiScore === "number" ? match.indicators.aiScore : null,
        reason: match.reason,
        indicators: JSON.stringify(match.indicators),
        userId,
      })),
    })
  }

  return NextResponse.json({
    strategy,
    count: scored.length,
    results: scored,
  })
}

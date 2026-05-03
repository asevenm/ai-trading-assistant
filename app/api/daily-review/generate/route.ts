import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import dayjs from "dayjs"
import {
  getMarketIndices,
  getSectorRanking,
  getMarketStats,
  getNorthboundFlow,
} from "@/lib/market-api"
import { generateDailyReview } from "@/lib/ai/daily-review-generator"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const date = body.date ? dayjs(body.date).startOf("day") : dayjs().startOf("day")

  // Check if review already exists
  const existing = await prisma.dailyReview.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date: date.toDate(),
      },
    },
  })

  if (existing) {
    return NextResponse.json({ error: "该日期的复盘已存在" }, { status: 400 })
  }

  // Fetch market data in parallel
  const [indices, sectors, stats, northbound] = await Promise.all([
    getMarketIndices(),
    getSectorRanking("industry", 20),
    getMarketStats(),
    getNorthboundFlow(),
  ])

  if (indices.length === 0) {
    return NextResponse.json(
      { error: "无法获取市场数据，可能非交易时间" },
      { status: 400 }
    )
  }

  // Generate AI summary
  const aiResult = await generateDailyReview({
    indices,
    sectors,
    stats,
    northbound,
    date: date.format("YYYY-MM-DD"),
  })

  // Save to database
  const review = await prisma.dailyReview.create({
    data: {
      date: date.toDate(),
      indexSummary: JSON.stringify(indices),
      sectorSummary: JSON.stringify(sectors),
      marketStats: JSON.stringify(stats),
      northbound: northbound ? JSON.stringify(northbound) : null,
      aiSummary: aiResult.summary,
      aiHotTopics: JSON.stringify(aiResult.hotTopics),
      userId: session.user.id,
    },
  })

  return NextResponse.json({
    ...review,
    outlook: aiResult.outlook,
  })
}

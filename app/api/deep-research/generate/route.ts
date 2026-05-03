import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getStockQuote } from "@/lib/stock-api"
import { getStockKline } from "@/lib/market-api"
import { getFinancialData, getStockProfile, getResearchReports } from "@/lib/finance-api"
import { generateDeepResearch } from "@/lib/ai/deep-research-generator"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { code, name, stockId } = await request.json()

  if (!code || !name) {
    return NextResponse.json({ error: "请提供股票代码和名称" }, { status: 400 })
  }

  // Fetch all data in parallel
  const [quote, klines, financial, profile, reports] = await Promise.all([
    getStockQuote(code),
    getStockKline(code, "daily", 120),
    getFinancialData(code),
    getStockProfile(code),
    getResearchReports(code, 10),
  ])

  if (!quote) {
    return NextResponse.json(
      { error: "无法获取股票行情数据" },
      { status: 400 }
    )
  }

  // Generate AI research
  const aiResult = await generateDeepResearch(code, name, {
    quote: {
      price: quote.price,
      changePercent: quote.changePercent,
      volume: quote.volume,
      turnover: quote.turnover,
    },
    klines,
    financial,
    profile,
    reports,
  })

  // Save to database
  const research = await prisma.deepResearch.create({
    data: {
      stockCode: code,
      stockName: name,
      fundamentals: aiResult.fundamentals,
      technicals: aiResult.technicals,
      catalysts: aiResult.catalysts,
      risks: aiResult.risks,
      valuation: aiResult.valuation,
      conclusion: aiResult.conclusion,
      rating: aiResult.rating,
      targetPrice: aiResult.targetPrice,
      userId: session.user.id,
      stockId: stockId || null,
    },
  })

  return NextResponse.json(research)
}

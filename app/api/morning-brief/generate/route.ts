import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getLimitUpSummary } from "@/lib/limit-up-api"
import { getSectorFlow, getStockFlowTop } from "@/lib/sector-flow-api"
import { generateMorningBrief } from "@/lib/ai/morning-brief-generator"
import dayjs from "dayjs"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = dayjs().startOf("day").toDate()

  // Fetch market data in parallel
  const [limitUpSummary, sectorInflow, stockInflow] = await Promise.all([
    getLimitUpSummary(),
    getSectorFlow("industry", 20),
    getStockFlowTop(20),
  ])

  // Generate AI brief
  const aiBrief = await generateMorningBrief({
    limitUpStocks: limitUpSummary.stocks,
    bustedCount: limitUpSummary.bustedCount,
    bustedRate: limitUpSummary.bustedRate,
    sectorInflow,
    stockInflow,
    date: dayjs().format("YYYY-MM-DD"),
  })

  // Save to database
  const brief = await prisma.morningBrief.upsert({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
    update: {
      limitUpAnalysis: JSON.stringify({
        total: limitUpSummary.total,
        bustedCount: limitUpSummary.bustedCount,
        bustedRate: limitUpSummary.bustedRate,
        stocks: limitUpSummary.stocks.slice(0, 30),
      }),
      focusSectors: JSON.stringify(sectorInflow.slice(0, 10)),
      focusStocks: JSON.stringify(aiBrief.focusStocks),
      aiStrategy: JSON.stringify(aiBrief),
    },
    create: {
      userId: session.user.id,
      date: today,
      limitUpAnalysis: JSON.stringify({
        total: limitUpSummary.total,
        bustedCount: limitUpSummary.bustedCount,
        bustedRate: limitUpSummary.bustedRate,
        stocks: limitUpSummary.stocks.slice(0, 30),
      }),
      focusSectors: JSON.stringify(sectorInflow.slice(0, 10)),
      focusStocks: JSON.stringify(aiBrief.focusStocks),
      aiStrategy: JSON.stringify(aiBrief),
    },
  })

  return NextResponse.json({
    id: brief.id,
    date: brief.date,
    ...aiBrief,
    limitUp: {
      total: limitUpSummary.total,
      bustedCount: limitUpSummary.bustedCount,
      bustedRate: limitUpSummary.bustedRate,
    },
    sectorInflow: sectorInflow.slice(0, 10),
  })
}

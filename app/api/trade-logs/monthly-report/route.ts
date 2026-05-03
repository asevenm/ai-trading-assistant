import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import dayjs from "dayjs"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const month = searchParams.get("month") || dayjs().format("YYYY-MM")

  const startDate = dayjs(month).startOf("month").toDate()
  const endDate = dayjs(month).endOf("month").toDate()

  const logs = await prisma.tradeLog.findMany({
    where: {
      userId: session.user.id,
      tradeTime: { gte: startDate, lte: endDate },
    },
    include: { tradePlan: { include: { stock: true } } },
    orderBy: { tradeTime: "asc" },
  })

  const sellLogs = logs.filter((l) => l.type === "sell")
  const buyLogs = logs.filter((l) => l.type === "buy")

  const totalPnL = sellLogs.reduce((sum, l) => sum + (l.realizedPnL || 0), 0)
  const wins = sellLogs.filter((l) => l.resultTag === "success").length
  const losses = sellLogs.filter((l) => l.resultTag === "failure").length
  const winRate = sellLogs.length > 0 ? (wins / sellLogs.length) * 100 : 0

  // Profit by week
  const weeklyPnL: { week: string; pnl: number; trades: number }[] = []
  const weekMap = new Map<string, { pnl: number; trades: number }>()
  for (const log of sellLogs) {
    const weekKey = dayjs(log.tradeTime).startOf("week").format("MM-DD")
    const current = weekMap.get(weekKey) || { pnl: 0, trades: 0 }
    current.pnl += log.realizedPnL || 0
    current.trades++
    weekMap.set(weekKey, current)
  }
  for (const [week, data] of weekMap) {
    weeklyPnL.push({ week: `${week}周`, ...data })
  }

  // By reason
  const reasonMap = new Map<string, { wins: number; losses: number; pnl: number }>()
  for (const log of sellLogs) {
    const buyLog = buyLogs.find((b) => b.tradePlanId === log.tradePlanId)
    const reason = buyLog?.entryReason || "未分类"
    const current = reasonMap.get(reason) || { wins: 0, losses: 0, pnl: 0 }
    if (log.resultTag === "success") current.wins++
    if (log.resultTag === "failure") current.losses++
    current.pnl += log.realizedPnL || 0
    reasonMap.set(reason, current)
  }

  const byReason = Array.from(reasonMap.entries()).map(([reason, data]) => ({
    reason,
    ...data,
    total: data.wins + data.losses,
    winRate: (data.wins + data.losses) > 0 ? (data.wins / (data.wins + data.losses)) * 100 : 0,
  }))

  // Max win / loss
  const maxWin = Math.max(0, ...sellLogs.map((l) => l.realizedPnL || 0))
  const maxLoss = Math.min(0, ...sellLogs.map((l) => l.realizedPnL || 0))

  // Cumulative PnL curve
  let cumulative = 0
  const pnlCurve = sellLogs.map((l) => {
    cumulative += l.realizedPnL || 0
    return {
      date: dayjs(l.tradeTime).format("MM-DD"),
      pnl: l.realizedPnL || 0,
      cumulative,
      stock: l.tradePlan.stock.name,
    }
  })

  return NextResponse.json({
    month,
    overview: {
      totalTrades: logs.length,
      buyCount: buyLogs.length,
      sellCount: sellLogs.length,
      wins,
      losses,
      winRate,
      totalPnL,
      avgPnL: sellLogs.length > 0 ? totalPnL / sellLogs.length : 0,
      maxWin,
      maxLoss,
    },
    weeklyPnL,
    byReason,
    pnlCurve,
  })
}

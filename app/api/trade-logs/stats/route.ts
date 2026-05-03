import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

interface ReasonStats {
  reason: string
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number
  totalPnL: number
  avgPnL: number
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const months = parseInt(searchParams.get("months") || "3")

  const since = new Date()
  since.setMonth(since.getMonth() - months)

  const logs = await prisma.tradeLog.findMany({
    where: {
      userId: session.user.id,
      tradeTime: { gte: since },
    },
    include: { tradePlan: { include: { stock: true } } },
    orderBy: { tradeTime: "desc" },
  })

  const sellLogs = logs.filter((l) => l.type === "sell")

  // Group by entryReason (from buy logs of same plan) or exitReason
  const reasonMap = new Map<string, { wins: number; losses: number; pnl: number }>()

  for (const log of sellLogs) {
    // Find the buy reason for this plan
    const buyLog = logs.find(
      (l) => l.tradePlanId === log.tradePlanId && l.type === "buy"
    )
    const reason = buyLog?.entryReason || log.exitReason || "未分类"
    const current = reasonMap.get(reason) || { wins: 0, losses: 0, pnl: 0 }

    if (log.resultTag === "success") {
      current.wins++
    } else if (log.resultTag === "failure") {
      current.losses++
    }
    current.pnl += log.realizedPnL || 0
    reasonMap.set(reason, current)
  }

  const byReason: ReasonStats[] = Array.from(reasonMap.entries()).map(
    ([reason, data]) => {
      const total = data.wins + data.losses
      return {
        reason,
        totalTrades: total,
        winCount: data.wins,
        lossCount: data.losses,
        winRate: total > 0 ? (data.wins / total) * 100 : 0,
        totalPnL: data.pnl,
        avgPnL: total > 0 ? data.pnl / total : 0,
      }
    }
  )

  byReason.sort((a, b) => b.totalTrades - a.totalTrades)

  // Same-type trade comparison: group sells by stock
  const byStock = new Map<
    string,
    { code: string; name: string; trades: number; wins: number; pnl: number }
  >()

  for (const log of sellLogs) {
    const code = log.tradePlan.stock.code
    const name = log.tradePlan.stock.name
    const current = byStock.get(code) || { code, name, trades: 0, wins: 0, pnl: 0 }
    current.trades++
    if (log.resultTag === "success") current.wins++
    current.pnl += log.realizedPnL || 0
    byStock.set(code, current)
  }

  const stockComparison = Array.from(byStock.values())
    .filter((s) => s.trades >= 2)
    .sort((a, b) => b.trades - a.trades)

  // Overall stats
  const totalSells = sellLogs.length
  const totalWins = sellLogs.filter((l) => l.resultTag === "success").length
  const totalPnL = sellLogs.reduce((sum, l) => sum + (l.realizedPnL || 0), 0)
  const maxWin = Math.max(0, ...sellLogs.map((l) => l.realizedPnL || 0))
  const maxLoss = Math.min(0, ...sellLogs.map((l) => l.realizedPnL || 0))

  return NextResponse.json({
    overview: {
      totalTrades: logs.length,
      totalSells,
      totalWins,
      winRate: totalSells > 0 ? (totalWins / totalSells) * 100 : 0,
      totalPnL,
      avgPnL: totalSells > 0 ? totalPnL / totalSells : 0,
      maxWin,
      maxLoss,
    },
    byReason,
    stockComparison,
  })
}

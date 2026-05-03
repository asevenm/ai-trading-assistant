import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import dayjs from "dayjs"

export interface RiskCheckResult {
  dailyPnL: number
  dailyPnLPercent: number
  dailyLossBreached: boolean
  consecutiveLosses: number
  consecutiveLossBreached: boolean
  totalPositionAmount: number
  totalPositionPercent: number
  totalPositionBreached: boolean
  positions: PositionItem[]
  positionBreaches: string[]
  todayTradeCount: number
  warnings: string[]
}

interface PositionItem {
  stockCode: string
  stockName: string
  quantity: number
  avgPrice: number
  amount: number
  positionPercent: number
  breached: boolean
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.riskSettings.findUnique({
    where: { userId: session.user.id },
  })

  if (!settings) {
    return NextResponse.json({ error: "请先配置风控参数" }, { status: 400 })
  }

  const todayStart = dayjs().startOf("day").toDate()

  // Get today's trade logs
  const todayLogs = await prisma.tradeLog.findMany({
    where: {
      userId: session.user.id,
      tradeTime: { gte: todayStart },
    },
    include: { tradePlan: { include: { stock: true } } },
    orderBy: { tradeTime: "desc" },
  })

  // Calculate daily PnL
  const dailyPnL = todayLogs.reduce((sum, log) => sum + (log.realizedPnL || 0), 0)
  const dailyPnLPercent = (dailyPnL / settings.totalCapital) * 100
  const dailyLossBreached = dailyPnLPercent < -settings.maxDailyLoss

  // Calculate consecutive losses (look at recent sell logs)
  const recentSellLogs = await prisma.tradeLog.findMany({
    where: {
      userId: session.user.id,
      type: "sell",
      resultTag: { not: null },
    },
    orderBy: { tradeTime: "desc" },
    take: 20,
  })

  let consecutiveLosses = 0
  for (const log of recentSellLogs) {
    if (log.resultTag === "failure") {
      consecutiveLosses++
    } else {
      break
    }
  }
  const consecutiveLossBreached = consecutiveLosses >= settings.maxConsecutiveLoss

  // Calculate current positions from trade logs
  // Group buy/sell by stock to compute net position
  const allLogs = await prisma.tradeLog.findMany({
    where: { userId: session.user.id },
    include: { tradePlan: { include: { stock: true } } },
    orderBy: { tradeTime: "asc" },
  })

  const positionMap = new Map<string, { code: string; name: string; quantity: number; totalCost: number }>()

  for (const log of allLogs) {
    const code = log.tradePlan.stock.code
    const name = log.tradePlan.stock.name
    const current = positionMap.get(code) || { code, name, quantity: 0, totalCost: 0 }

    if (log.type === "buy") {
      current.totalCost += log.amount
      current.quantity += log.quantity
    } else {
      current.quantity -= log.quantity
      if (current.quantity <= 0) {
        current.quantity = 0
        current.totalCost = 0
      } else {
        // Reduce cost proportionally
        const avgCost = current.totalCost / (current.quantity + log.quantity)
        current.totalCost = avgCost * current.quantity
      }
    }

    positionMap.set(code, current)
  }

  const positions: PositionItem[] = []
  const positionBreaches: string[] = []
  let totalPositionAmount = 0

  for (const [, pos] of positionMap) {
    if (pos.quantity <= 0) continue

    const avgPrice = pos.totalCost / pos.quantity
    const amount = pos.totalCost
    const positionPercent = (amount / settings.totalCapital) * 100

    totalPositionAmount += amount

    const breached = positionPercent > settings.maxSinglePosition
    if (breached) {
      positionBreaches.push(
        `${pos.name}(${pos.code}) 仓位 ${positionPercent.toFixed(1)}% 超过限制 ${settings.maxSinglePosition}%`
      )
    }

    positions.push({
      stockCode: pos.code,
      stockName: pos.name,
      quantity: pos.quantity,
      avgPrice,
      amount,
      positionPercent,
      breached,
    })
  }

  const totalPositionPercent = (totalPositionAmount / settings.totalCapital) * 100
  const totalPositionBreached = totalPositionPercent > settings.maxTotalPosition

  // Build warnings
  const warnings: string[] = []
  if (dailyLossBreached) {
    warnings.push(`今日亏损 ${dailyPnLPercent.toFixed(2)}% 已超过限制 ${settings.maxDailyLoss}%，建议停止交易`)
  }
  if (consecutiveLossBreached) {
    warnings.push(`连续亏损 ${consecutiveLosses} 次，已达预警阈值 ${settings.maxConsecutiveLoss} 次，建议休息反思`)
  }
  if (totalPositionBreached) {
    warnings.push(`总仓位 ${totalPositionPercent.toFixed(1)}% 超过限制 ${settings.maxTotalPosition}%`)
  }
  positionBreaches.forEach((b) => warnings.push(b))

  const result: RiskCheckResult = {
    dailyPnL,
    dailyPnLPercent,
    dailyLossBreached,
    consecutiveLosses,
    consecutiveLossBreached,
    totalPositionAmount,
    totalPositionPercent,
    totalPositionBreached,
    positions,
    positionBreaches,
    todayTradeCount: todayLogs.length,
    warnings,
  }

  return NextResponse.json(result)
}

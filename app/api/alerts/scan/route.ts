import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { scanAlerts, type AlertRuleConfig } from "@/lib/alert-scanner"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  try {
    // Fetch user's alert rules
    const dbRules = await prisma.alertRule.findMany({
      where: { userId, enabled: true },
    })

    if (dbRules.length === 0) {
      return NextResponse.json({ alerts: [], newCount: 0 })
    }

    // Fetch user's watchlist stock codes
    const stocks = await prisma.stock.findMany({
      where: { userId },
      select: { code: true },
    })
    const watchlistCodes = stocks.map((s) => s.code)

    // Convert DB rules to scanner config
    const rules: AlertRuleConfig[] = dbRules.map((r) => ({
      id: r.id,
      type: r.type as AlertRuleConfig["type"],
      threshold: r.threshold,
      scope: r.scope as AlertRuleConfig["scope"],
      stockCodes: r.stockCodes ? JSON.parse(r.stockCodes) : undefined,
      enabled: r.enabled,
    }))

    // Run scanner
    const scanResults = await scanAlerts(rules, watchlistCodes)

    if (scanResults.length === 0) {
      return NextResponse.json({ alerts: [], newCount: 0 })
    }

    // Deduplicate: skip alerts already created in the last 10 minutes for same stock+type
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    const recentAlerts = await prisma.alert.findMany({
      where: {
        userId,
        createdAt: { gte: tenMinutesAgo },
      },
      select: { stockCode: true, type: true },
    })

    const recentKeys = new Set(
      recentAlerts.map((a) => `${a.stockCode}:${a.type}`)
    )

    const newResults = scanResults.filter(
      (r) => !recentKeys.has(`${r.stockCode}:${r.type}`)
    )

    if (newResults.length === 0) {
      return NextResponse.json({ alerts: [], newCount: 0 })
    }

    // Save new alerts
    const created = await prisma.$transaction(
      newResults.map((r) =>
        prisma.alert.create({
          data: {
            type: r.type,
            stockCode: r.stockCode,
            stockName: r.stockName,
            message: r.message,
            detail: JSON.stringify(r.detail),
            currentValue: r.currentValue,
            threshold: r.threshold,
            ruleId: r.ruleId,
            userId,
          },
        })
      )
    )

    return NextResponse.json({ alerts: created, newCount: created.length })
  } catch (error) {
    console.error("Alert scan failed:", error)
    return NextResponse.json(
      { error: "扫描失败", detail: String(error) },
      { status: 500 }
    )
  }
}

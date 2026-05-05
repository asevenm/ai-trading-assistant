import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { scanPreLimitUp, type PreLimitUpCandidate } from "@/lib/pre-limit-up-api"
import { getSealOrderRanking, type SealOrderStock } from "@/lib/seal-order-api"
import { buildStageLookup, STAGE_LABELS } from "@/lib/rotation/stage-lookup"
import { getTradeDate } from "@/lib/rotation/snapshot/time-slots"
import type { Alert } from "@prisma/client"
import type { RotationStage } from "@/lib/rotation/types"

export interface HotTheme {
  boardId: string
  boardName: string
  boardType: "INDUSTRY" | "CONCEPT"
  stage: RotationStage
  stageLabel: string
  strengthScore: number
  deltaScore: number | null
  limitUpCount: number
  topStreak: number
  mainNetInflow: number
  leaderStocks: string[]
}

export interface LiveTradingDashboard {
  scannedAt: string
  tradeDate: string
  hotThemes: HotTheme[]
  preLimitUp: PreLimitUpCandidate[]
  sealOrders: SealOrderStock[]
  recentHotAlerts: Alert[]
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const tradeDate = getTradeDate()

  // 4 个数据源并行抓取
  const [hotThemes, preLimitUp, sealOrders, recentHotAlerts] = await Promise.all([
    fetchHotThemes(tradeDate),
    scanPreLimitUp().catch((err) => {
      console.error("preLimitUp failed:", err)
      return [] as PreLimitUpCandidate[]
    }),
    getSealOrderRanking().catch((err) => {
      console.error("sealOrders failed:", err)
      return [] as SealOrderStock[]
    }),
    fetchRecentHotAlerts(userId),
  ])

  return NextResponse.json<LiveTradingDashboard>({
    scannedAt: new Date().toISOString(),
    tradeDate,
    hotThemes,
    preLimitUp: preLimitUp.slice(0, 12),
    sealOrders: sealOrders.slice(0, 10),
    recentHotAlerts,
  })
}

/**
 * 拉取当日 RISING + STARTING 板块，按 strengthScore 倒序，限 8 条。
 * 同 boardId 多 timeSlot 取最新（按 timeSlot 字典序最大）。
 */
async function fetchHotThemes(tradeDate: string): Promise<HotTheme[]> {
  const lookup = await buildStageLookup(tradeDate)
  if (lookup.byBoardId.size === 0) return []

  // 拿当日 / 最新一日所有快照（含分数与原始指标），按 boardId 取最新 timeSlot
  const rows = await prisma.boardSnapshot.findMany({
    where: { tradeDate, stage: { in: ["RISING", "STARTING"] } },
    orderBy: [{ tradeDate: "desc" }, { timeSlot: "desc" }],
  })

  // 同 boardId 取第一条（最新）
  const seen = new Set<string>()
  const latest = rows.filter((r) => {
    if (seen.has(r.boardId)) return false
    seen.add(r.boardId)
    return true
  })

  // 当日无数据 → 回溯到最新一个有数据的交易日（与 stage-lookup 行为一致）
  if (latest.length === 0) {
    const fallbackDate = await prisma.boardSnapshot.findFirst({
      where: { tradeDate: { lt: tradeDate }, stage: { in: ["RISING", "STARTING"] } },
      orderBy: { tradeDate: "desc" },
      select: { tradeDate: true },
    })
    if (!fallbackDate) return []

    const fallbackRows = await prisma.boardSnapshot.findMany({
      where: { tradeDate: fallbackDate.tradeDate, stage: { in: ["RISING", "STARTING"] } },
      orderBy: [{ timeSlot: "desc" }],
    })
    const fallbackSeen = new Set<string>()
    const fallbackLatest = fallbackRows.filter((r) => {
      if (fallbackSeen.has(r.boardId)) return false
      fallbackSeen.add(r.boardId)
      return true
    })
    return toHotThemes(fallbackLatest)
  }

  return toHotThemes(latest)
}

function toHotThemes(
  rows: Array<{
    boardId: string
    boardName: string
    boardType: string
    stage: string | null
    strengthScore: number
    deltaScore: number | null
    limitUpCount: number
    topStreak: number
    mainNetInflow: number
    leaderStocks: string
  }>,
): HotTheme[] {
  return rows
    .filter((r) => r.stage === "RISING" || r.stage === "STARTING")
    .sort((a, b) => {
      // RISING 优先于 STARTING
      const stageOrder = (s: string | null) => (s === "RISING" ? 2 : s === "STARTING" ? 1 : 0)
      const stageDiff = stageOrder(b.stage) - stageOrder(a.stage)
      if (stageDiff !== 0) return stageDiff
      return b.strengthScore - a.strengthScore
    })
    .slice(0, 8)
    .map((r) => {
      const stage = r.stage as RotationStage
      let leaderStocks: string[] = []
      try {
        const parsed = JSON.parse(r.leaderStocks) as unknown
        if (Array.isArray(parsed)) {
          leaderStocks = parsed.filter((x): x is string => typeof x === "string")
        }
      } catch {
        // ignore
      }
      return {
        boardId: r.boardId,
        boardName: r.boardName,
        boardType: r.boardType === "INDUSTRY" ? "INDUSTRY" : "CONCEPT",
        stage,
        stageLabel: STAGE_LABELS[stage],
        strengthScore: r.strengthScore,
        deltaScore: r.deltaScore,
        limitUpCount: r.limitUpCount,
        topStreak: r.topStreak,
        mainNetInflow: r.mainNetInflow,
        leaderStocks,
      }
    })
}

/**
 * 最近 30 分钟、 themeStage 命中 RISING/STARTING 的 alert，限 30 条
 */
async function fetchRecentHotAlerts(userId: string): Promise<Alert[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000)
  const rows = await prisma.alert.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 80,
  })

  return rows
    .filter((a) => {
      if (!a.detail) return false
      try {
        const parsed = JSON.parse(a.detail) as { themeStage?: string }
        return parsed.themeStage === "RISING" || parsed.themeStage === "STARTING"
      } catch {
        return false
      }
    })
    .slice(0, 30)
}
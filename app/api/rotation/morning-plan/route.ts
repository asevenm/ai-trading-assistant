import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTradeDate } from "@/lib/rotation/snapshot/time-slots"
import type { BoardType } from "@/lib/rotation/types"

/**
 * GET /api/rotation/morning-plan?boardType=CONCEPT
 *
 * 盘前预判：
 * - 昨日尾盘强度延续度 (14:30 → CLOSE)
 * - 昨日处于 STARTING/RISING 的板块（接力候选）
 * - 昨日处于 DIVERGING 的高位板块（风险预警）
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const boardType = (params.get("boardType") ?? "CONCEPT") as BoardType

  if (boardType !== "INDUSTRY" && boardType !== "CONCEPT") {
    return NextResponse.json({ error: "Invalid boardType" }, { status: 400 })
  }

  // 找最近一个有数据的交易日（往前看）
  const today = getTradeDate()
  const prevDayRecord = await prisma.boardSnapshot.findFirst({
    where: { boardType, tradeDate: { lt: today } },
    orderBy: { tradeDate: "desc" },
    select: { tradeDate: true },
  })

  if (!prevDayRecord) {
    return NextResponse.json({
      prevTradeDate: null,
      relayCandidates: [],
      riskWarnings: [],
      tailContinuity: [],
    })
  }

  const prevTradeDate = prevDayRecord.tradeDate

  // 昨日所有快照
  const allSnapshots = await prisma.boardSnapshot.findMany({
    where: { boardType, tradeDate: prevTradeDate },
  })

  // 按 boardId 分组
  const byBoard = new Map<string, typeof allSnapshots>()
  for (const s of allSnapshots) {
    const list = byBoard.get(s.boardId) ?? []
    byBoard.set(s.boardId, [...list, s])
  }

  const tailContinuity: Array<{
    boardId: string
    boardName: string
    score1430: number
    scoreClose: number
    delta: number
    stage: string | null
  }> = []
  const relayCandidates: Array<{
    boardId: string
    boardName: string
    closeScore: number
    stage: string | null
    leaderStocks: string[]
    limitUpCount: number
    topStreak: number
  }> = []
  const riskWarnings: Array<{
    boardId: string
    boardName: string
    closeScore: number
    stage: string | null
    reason: string | null
    leaderStocks: string[]
  }> = []

  for (const [, snapshots] of byBoard) {
    const close = snapshots.find((s) => s.timeSlot === "CLOSE")
    const t1430 = snapshots.find((s) => s.timeSlot === "1430")
    if (!close) continue

    // 尾盘延续度
    if (t1430) {
      tailContinuity.push({
        boardId: close.boardId,
        boardName: close.boardName,
        score1430: t1430.strengthScore,
        scoreClose: close.strengthScore,
        delta: round1(close.strengthScore - t1430.strengthScore),
        stage: close.stage,
      })
    }

    // 接力候选 - 昨日 STARTING / RISING
    if (close.stage === "STARTING" || close.stage === "RISING") {
      relayCandidates.push({
        boardId: close.boardId,
        boardName: close.boardName,
        closeScore: close.strengthScore,
        stage: close.stage,
        leaderStocks: safeParseArray(close.leaderStocks),
        limitUpCount: close.limitUpCount,
        topStreak: close.topStreak,
      })
    }

    // 风险预警 - 昨日 DIVERGING 的高位板块（S>=70）
    if (close.stage === "DIVERGING" && close.strengthScore >= 70) {
      riskWarnings.push({
        boardId: close.boardId,
        boardName: close.boardName,
        closeScore: close.strengthScore,
        stage: close.stage,
        reason: close.stageReason,
        leaderStocks: safeParseArray(close.leaderStocks),
      })
    }
  }

  // 排序：尾盘延续度按 delta 降序（尾盘还在加强的优先），候选按强度分
  tailContinuity.sort((a, b) => b.delta - a.delta)
  relayCandidates.sort((a, b) => b.closeScore - a.closeScore)
  riskWarnings.sort((a, b) => b.closeScore - a.closeScore)

  return NextResponse.json({
    prevTradeDate,
    tailContinuity: tailContinuity.slice(0, 15),
    relayCandidates: relayCandidates.slice(0, 10),
    riskWarnings: riskWarnings.slice(0, 10),
  })
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function safeParseArray(s: string): string[] {
  try {
    const parsed = JSON.parse(s)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

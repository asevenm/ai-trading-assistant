import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTradeDate, TIME_SLOTS } from "@/lib/rotation/snapshot/time-slots"
import type { BoardType } from "@/lib/rotation/types"

/**
 * GET /api/rotation/daily-evolution?boardType=CONCEPT&date=YYYY-MM-DD&topN=20
 *
 * 返回当日 Top N 板块在 7 个 timeSlot 上的强度分演化矩阵
 * 用途：盘后复盘的轮动热力图
 *
 * Response:
 * {
 *   tradeDate, prevTradeDate,
 *   timeSlots: ["PRE_OPEN", ...],
 *   boards: [{ boardId, boardName, scores: { PRE_OPEN: 56, "0930": 60, ... } }],
 *   topMainline: [...top 3 by latest strength], // 含 stage, leaders
 *   risingFromYesterday: [...板块今日新进 Top 10],
 *   fadedFromYesterday: [...昨日 Top 10 今日掉出]
 * }
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const boardType = (params.get("boardType") ?? "CONCEPT") as BoardType
  const tradeDate = params.get("date") ?? getTradeDate()
  const topN = Math.min(Number(params.get("topN") ?? 20), 50)

  if (boardType !== "INDUSTRY" && boardType !== "CONCEPT") {
    return NextResponse.json({ error: "Invalid boardType" }, { status: 400 })
  }

  // 当日 CLOSE（或最新）的 Top N 强势板块
  const latestSlot = await prisma.boardSnapshot.findFirst({
    where: { tradeDate, boardType },
    orderBy: { timeSlot: "desc" },
    select: { timeSlot: true },
  })

  if (!latestSlot) {
    return NextResponse.json({
      tradeDate,
      prevTradeDate: null,
      timeSlots: [],
      boards: [],
      topMainline: [],
      risingFromYesterday: [],
      fadedFromYesterday: [],
    })
  }

  const todayTop = await prisma.boardSnapshot.findMany({
    where: { tradeDate, boardType, timeSlot: latestSlot.timeSlot },
    orderBy: { strengthScore: "desc" },
    take: topN,
  })

  const boardIds = todayTop.map((b) => b.boardId)

  // 当日所有快照（仅取 Top N 板块）
  const allTodaySnapshots = await prisma.boardSnapshot.findMany({
    where: { tradeDate, boardType, boardId: { in: boardIds } },
  })

  // 昨日 CLOSE Top 10 用于切换轨迹
  const prevTradeDateRecord = await prisma.boardSnapshot.findFirst({
    where: { boardType, tradeDate: { lt: tradeDate } },
    orderBy: { tradeDate: "desc" },
    select: { tradeDate: true },
  })
  const prevTradeDate = prevTradeDateRecord?.tradeDate ?? null

  let yesterdayTop: typeof todayTop = []
  if (prevTradeDate) {
    const prevLatest = await prisma.boardSnapshot.findFirst({
      where: { boardType, tradeDate: prevTradeDate },
      orderBy: { timeSlot: "desc" },
      select: { timeSlot: true },
    })
    if (prevLatest) {
      yesterdayTop = await prisma.boardSnapshot.findMany({
        where: { boardType, tradeDate: prevTradeDate, timeSlot: prevLatest.timeSlot },
        orderBy: { strengthScore: "desc" },
        take: 10,
      })
    }
  }

  // 构建 board × timeSlot 矩阵
  const boardMap = new Map<string, { boardId: string; boardName: string; scores: Record<string, number> }>()
  for (const b of todayTop) {
    boardMap.set(b.boardId, { boardId: b.boardId, boardName: b.boardName, scores: {} })
  }
  for (const s of allTodaySnapshots) {
    const entry = boardMap.get(s.boardId)
    if (entry) entry.scores[s.timeSlot] = s.strengthScore
  }

  // 切换轨迹：今日 Top 10 vs 昨日 Top 10
  const todayTop10 = todayTop.slice(0, 10).map((b) => b.boardId)
  const yesterdayTop10 = yesterdayTop.slice(0, 10).map((b) => b.boardId)
  const yesterdaySet = new Set(yesterdayTop10)
  const todaySet = new Set(todayTop10)

  const risingFromYesterday = todayTop
    .slice(0, 10)
    .filter((b) => !yesterdaySet.has(b.boardId))
    .map((b) => ({ boardId: b.boardId, boardName: b.boardName, strengthScore: b.strengthScore, stage: b.stage }))

  const fadedFromYesterday = yesterdayTop
    .filter((b) => !todaySet.has(b.boardId))
    .map((b) => ({
      boardId: b.boardId,
      boardName: b.boardName,
      yesterdayScore: b.strengthScore,
      stage: b.stage,
    }))

  const topMainline = todayTop.slice(0, 3).map((b) => ({
    boardId: b.boardId,
    boardName: b.boardName,
    strengthScore: b.strengthScore,
    deltaScore: b.deltaScore,
    stage: b.stage,
    stageReason: b.stageReason,
    limitUpCount: b.limitUpCount,
    topStreak: b.topStreak,
    leaderStocks: safeParseArray(b.leaderStocks),
  }))

  return NextResponse.json({
    tradeDate,
    prevTradeDate,
    timeSlots: TIME_SLOTS.filter((slot) =>
      allTodaySnapshots.some((s) => s.timeSlot === slot)
    ),
    boards: Array.from(boardMap.values()),
    topMainline,
    risingFromYesterday,
    fadedFromYesterday,
  })
}

function safeParseArray(s: string): string[] {
  try {
    const parsed = JSON.parse(s)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

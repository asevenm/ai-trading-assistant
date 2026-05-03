import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { BoardType } from "@/lib/rotation/types"

/**
 * GET /api/rotation/replay?boardId=BK0420&boardType=CONCEPT&days=10
 *
 * 单板块的历史强度时序回放（用于阶段地图轨迹 + 板块详情页）
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const boardId = params.get("boardId")
  const boardType = (params.get("boardType") ?? "CONCEPT") as BoardType
  const days = Math.min(Number(params.get("days") ?? 10), 60)

  if (!boardId) {
    return NextResponse.json({ error: "boardId required" }, { status: 400 })
  }
  if (boardType !== "INDUSTRY" && boardType !== "CONCEPT") {
    return NextResponse.json({ error: "Invalid boardType" }, { status: 400 })
  }

  // 取最近 days 个交易日的所有快照
  const recentDates = await prisma.boardSnapshot.findMany({
    where: { boardId, boardType },
    distinct: ["tradeDate"],
    select: { tradeDate: true },
    orderBy: { tradeDate: "desc" },
    take: days,
  })
  const dateList = recentDates.map((d) => d.tradeDate)

  if (dateList.length === 0) {
    return NextResponse.json({ boardId, boardType, points: [] })
  }

  const snapshots = await prisma.boardSnapshot.findMany({
    where: { boardId, boardType, tradeDate: { in: dateList } },
    orderBy: [{ tradeDate: "asc" }, { timeSlot: "asc" }],
  })

  return NextResponse.json({
    boardId,
    boardType,
    points: snapshots.map((s) => ({
      tradeDate: s.tradeDate,
      timeSlot: s.timeSlot,
      strengthScore: s.strengthScore,
      deltaScore: s.deltaScore,
      accelScore: s.accelScore,
      stage: s.stage,
      changePct: s.changePct,
      limitUpCount: s.limitUpCount,
      mainNetInflow: s.mainNetInflow,
      topStreak: s.topStreak,
    })),
  })
}

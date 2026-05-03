import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTradeDate } from "@/lib/rotation/snapshot/time-slots"
import type { BoardType } from "@/lib/rotation/types"

/**
 * GET /api/rotation/radar?boardType=CONCEPT&date=YYYY-MM-DD&timeSlot=CLOSE
 *
 * 返回阶段地图所需的板块快照（含 strength/delta/accel/stage）
 * 默认取当日最新 timeSlot；用 timeSlot 参数可指定时点
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const boardType = (params.get("boardType") ?? "CONCEPT") as BoardType
  const tradeDate = params.get("date") ?? getTradeDate()
  const requestedSlot = params.get("timeSlot")
  const limit = Math.min(Number(params.get("limit") ?? 60), 200)

  if (boardType !== "INDUSTRY" && boardType !== "CONCEPT") {
    return NextResponse.json({ error: "Invalid boardType" }, { status: 400 })
  }

  // 解析 timeSlot：未指定时取该日期下最新一个
  let timeSlot: string | null = requestedSlot
  if (!timeSlot) {
    const latest = await prisma.boardSnapshot.findFirst({
      where: { tradeDate, boardType },
      orderBy: { timeSlot: "desc" },
      select: { timeSlot: true },
    })
    timeSlot = latest?.timeSlot ?? null
  }

  if (!timeSlot) {
    return NextResponse.json({
      tradeDate,
      timeSlot: null,
      boards: [],
      availableSlots: [],
    })
  }

  const boards = await prisma.boardSnapshot.findMany({
    where: { tradeDate, boardType, timeSlot },
    orderBy: { strengthScore: "desc" },
    take: limit,
  })

  // 同时返回当日所有可选 timeSlot（供前端时间轴）
  const availableSlots = await prisma.boardSnapshot.findMany({
    where: { tradeDate, boardType },
    distinct: ["timeSlot"],
    select: { timeSlot: true },
    orderBy: { timeSlot: "asc" },
  })

  return NextResponse.json({
    tradeDate,
    timeSlot,
    availableSlots: availableSlots.map((s) => s.timeSlot),
    boards: boards.map((b) => ({
      boardId: b.boardId,
      boardName: b.boardName,
      boardType: b.boardType,
      strengthScore: b.strengthScore,
      deltaScore: b.deltaScore,
      accelScore: b.accelScore,
      stage: b.stage,
      stageReason: b.stageReason,
      changePct: b.changePct,
      limitUpCount: b.limitUpCount,
      mainNetInflow: b.mainNetInflow,
      topStreak: b.topStreak,
      turnoverRate: b.turnoverRate,
      leaderStocks: safeParseArray(b.leaderStocks),
    })),
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

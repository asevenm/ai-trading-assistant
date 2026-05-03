import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTradeDate } from "@/lib/rotation/snapshot/time-slots"
import type { BoardType } from "@/lib/rotation/types"

/**
 * GET /api/rotation/live?boardType=CONCEPT&limit=30
 *
 * 返回当前最新一个快照里的板块强度排名（按 strengthScore 降序）
 * 供 rotation-live 看板和 theme-radar 使用
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const boardType = (params.get("boardType") ?? "CONCEPT") as BoardType
  const limit = Number(params.get("limit") ?? 30)
  const tradeDate = params.get("tradeDate") ?? getTradeDate()

  if (boardType !== "INDUSTRY" && boardType !== "CONCEPT") {
    return NextResponse.json({ error: "Invalid boardType" }, { status: 400 })
  }

  // 找当日最新 timeSlot
  const latestSlot = await prisma.boardSnapshot.findFirst({
    where: { tradeDate, boardType },
    orderBy: { timeSlot: "desc" },
    select: { timeSlot: true },
  })

  if (!latestSlot) {
    return NextResponse.json({
      tradeDate,
      timeSlot: null,
      boards: [],
    })
  }

  const boards = await prisma.boardSnapshot.findMany({
    where: {
      tradeDate,
      boardType,
      timeSlot: latestSlot.timeSlot,
    },
    orderBy: { strengthScore: "desc" },
    take: limit,
  })

  return NextResponse.json({
    tradeDate,
    timeSlot: latestSlot.timeSlot,
    boards: boards.map((b) => ({
      ...b,
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

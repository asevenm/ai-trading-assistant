import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTradeDate } from "@/lib/rotation/snapshot/time-slots"

/**
 * GET /api/rotation/events?limit=50
 *
 * 当日轮动事件流（盘中告警、阶段变化）
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const limit = Math.min(Number(params.get("limit") ?? 50), 200)
  const tradeDate = params.get("tradeDate") ?? getTradeDate()
  const eventType = params.get("eventType")

  const events = await prisma.rotationEvent.findMany({
    where: {
      tradeDate,
      ...(eventType ? { eventType } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  })

  return NextResponse.json({
    tradeDate,
    events: events.map((e) => ({
      ...e,
      payload: safeParseObject(e.payload),
    })),
  })
}

function safeParseObject(s: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(s)
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

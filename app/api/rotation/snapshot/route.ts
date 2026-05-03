import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { takeSnapshot } from "@/lib/rotation/snapshot/build"
import { TIME_SLOTS } from "@/lib/rotation/snapshot/time-slots"
import type { TimeSlot } from "@/lib/rotation/types"

/**
 * POST /api/rotation/snapshot
 * Body (optional): { timeSlot?: TimeSlot, tradeDate?: string, withTurnover?: boolean }
 *
 * 触发一次全量快照采集（耗时较长，建议交给 cron 调用）
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    timeSlot?: TimeSlot
    tradeDate?: string
    withTurnover?: boolean
  } = {}

  try {
    body = await request.json()
  } catch {
    // empty body 也允许
  }

  if (body.timeSlot && !TIME_SLOTS.includes(body.timeSlot)) {
    return NextResponse.json(
      { error: `Invalid timeSlot. Must be one of: ${TIME_SLOTS.join(", ")}` },
      { status: 400 }
    )
  }

  try {
    const result = await takeSnapshot(body)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Snapshot failed:", error)
    return NextResponse.json(
      { error: "Snapshot failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

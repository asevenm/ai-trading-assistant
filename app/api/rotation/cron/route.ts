/**
 * GET / POST /api/rotation/cron
 *
 * 受 token 保护的 cron 触发端点。
 *
 * 鉴权：
 *   - Header `Authorization: Bearer <ROTATION_CRON_TOKEN>` 或
 *   - Query `?token=<ROTATION_CRON_TOKEN>` 或
 *   - Vercel Cron 自带的 `Authorization: Bearer <CRON_SECRET>` (走同一个 env)
 *
 * 行为：
 *   1. 校验 token，未配置或不匹配 → 401
 *   2. 北京时间判断：周末/节假日 → 直接返回 skipped: "non_trading_day"
 *   3. 计算当前对应的 timeSlot（容错窗口 ±8 分钟）；不在任何窗口 → skipped: "off_window"
 *   4. 调用 takeSnapshot 入库
 *   5. 返回结果
 *
 * 既支持 GET（方便 curl + Vercel Cron）也支持 POST（保留接口）。
 *
 * 可选 query 参数（仅用于手动测试 / 补录）：
 *   - force=1            绕过非交易日检查
 *   - timeSlot=PRE_OPEN  绕过容错窗口直接指定
 *   - tradeDate=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from "next/server"
import { takeSnapshot } from "@/lib/rotation/snapshot/build"
import {
  getScheduledSlot,
  isTradingDay,
} from "@/lib/rotation/snapshot/scheduler"
import { TIME_SLOTS } from "@/lib/rotation/snapshot/time-slots"
import type { TimeSlot } from "@/lib/rotation/types"

export const dynamic = "force-dynamic"

async function handle(request: NextRequest) {
  const expected = process.env.ROTATION_CRON_TOKEN
  if (!expected) {
    return NextResponse.json(
      { error: "ROTATION_CRON_TOKEN not configured on server" },
      { status: 500 }
    )
  }

  const params = request.nextUrl.searchParams
  const queryToken = params.get("token")
  const headerAuth = request.headers.get("authorization") ?? ""
  const headerToken = headerAuth.startsWith("Bearer ")
    ? headerAuth.slice("Bearer ".length).trim()
    : ""

  if (queryToken !== expected && headerToken !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const force = params.get("force") === "1"
  const explicitSlot = params.get("timeSlot") as TimeSlot | null
  const explicitTradeDate = params.get("tradeDate")

  if (explicitSlot && !TIME_SLOTS.includes(explicitSlot)) {
    return NextResponse.json(
      { error: `Invalid timeSlot. Must be one of: ${TIME_SLOTS.join(", ")}` },
      { status: 400 }
    )
  }

  // 1. 交易日判断
  if (!force && !isTradingDay()) {
    return NextResponse.json({
      skipped: "non_trading_day",
      checkedAt: new Date().toISOString(),
    })
  }

  // 2. 时间槽判断
  const slot = explicitSlot ?? getScheduledSlot()
  if (!slot) {
    return NextResponse.json({
      skipped: "off_window",
      checkedAt: new Date().toISOString(),
      hint: "当前时间不在任何调度槽容错窗口内",
    })
  }

  // 3. 触发快照
  try {
    const result = await takeSnapshot({
      timeSlot: slot,
      tradeDate: explicitTradeDate ?? undefined,
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Cron snapshot failed:", error)
    return NextResponse.json(
      {
        error: "Snapshot failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runPromotionBacktest } from "@/lib/ai/promotion-backtest"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const days = Math.max(3, Math.min(60, Number(url.searchParams.get("days")) || 20))
  const maxPerDay = Math.max(20, Math.min(200, Number(url.searchParams.get("maxPerDay")) || 100))

  try {
    const report = await runPromotionBacktest(days, maxPerDay)
    return NextResponse.json(report)
  } catch (error) {
    console.error("backtest error:", error)
    return NextResponse.json({ error: "Backtest failed" }, { status: 500 })
  }
}

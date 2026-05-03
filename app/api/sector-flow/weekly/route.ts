import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSectorFlowTrend } from "@/lib/sector-flow-api"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const type = (params.get("type") || "industry") as "industry" | "concept"
  const days = Math.max(2, Math.min(10, Number(params.get("days") || 5)))
  const count = Math.max(5, Math.min(30, Number(params.get("count") || 15)))

  const trend = await getSectorFlowTrend(type, days, count)
  return NextResponse.json(trend)
}

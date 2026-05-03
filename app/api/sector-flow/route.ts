import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSectorFlow, getStockFlowTop } from "@/lib/sector-flow-api"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const type = (request.nextUrl.searchParams.get("type") || "industry") as "industry" | "concept"

  const [sectorInflow, stockFlow] = await Promise.all([
    getSectorFlow(type, 30),
    getStockFlowTop(20),
  ])

  return NextResponse.json({
    sectors: sectorInflow,
    stocks: stockFlow,
  })
}

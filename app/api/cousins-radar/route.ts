import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { findAggregatedCousins } from "@/lib/cousin-finder"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 50))
  const maxChangePercent = Number(url.searchParams.get("maxChange")) || 5
  const minLimitUpBoards = Math.max(
    1,
    Math.min(10, Number(url.searchParams.get("minBoards")) || 1)
  )

  try {
    const report = await findAggregatedCousins({
      limit,
      maxChangePercent,
      minLimitUpBoards,
    })
    return NextResponse.json(report)
  } catch (error) {
    console.error("aggregated cousins error:", error)
    return NextResponse.json({ error: "Failed to scan" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAuctionSummary } from "@/lib/auction-api"
import { analyzeAuction } from "@/lib/ai/auction-analyzer"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await getAuctionSummary()
    const analysis = await analyzeAuction(summary)
    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Failed to analyze auction:", error)
    return NextResponse.json(
      { error: "Failed to analyze auction" },
      { status: 500 }
    )
  }
}

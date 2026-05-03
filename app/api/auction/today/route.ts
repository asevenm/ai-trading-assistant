import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAuctionSummary } from "@/lib/auction-api"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await getAuctionSummary()
    return NextResponse.json(summary)
  } catch (error) {
    console.error("Failed to fetch auction summary:", error)
    return NextResponse.json(
      { error: "Failed to fetch auction data" },
      { status: 500 }
    )
  }
}

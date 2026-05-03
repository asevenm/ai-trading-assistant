import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSealOrderRanking } from "@/lib/seal-order-api"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date") ?? undefined

  try {
    const ranking = await getSealOrderRanking(date)
    return NextResponse.json({
      total: ranking.length,
      ranking,
      scannedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Seal order ranking failed:", error)
    return NextResponse.json(
      { error: "Failed to fetch seal order ranking" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGuestTrackerSnapshot } from "@/lib/guest-tracker-api"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const days = Math.max(3, Math.min(15, Number(searchParams.get("days") ?? 5)))

  try {
    const snapshot = await getGuestTrackerSnapshot(days)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("Guest tracker fetch failed:", error)
    return NextResponse.json(
      { error: "Failed to fetch guest tracker data" },
      { status: 500 }
    )
  }
}

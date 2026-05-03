import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getThemeRadarSnapshot } from "@/lib/theme-radar-api"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date") ?? undefined

  try {
    const snapshot = await getThemeRadarSnapshot(date)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("Theme radar fetch failed:", error)
    return NextResponse.json(
      { error: "Failed to fetch theme radar data" },
      { status: 500 }
    )
  }
}

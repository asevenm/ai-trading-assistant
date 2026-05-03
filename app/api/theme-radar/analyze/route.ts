import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getThemeRadarSnapshot } from "@/lib/theme-radar-api"
import { analyzeThemeExpansion } from "@/lib/ai/theme-cluster"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const date = typeof body?.date === "string" ? body.date : undefined

    const snapshot = await getThemeRadarSnapshot(date)
    const analysis = await analyzeThemeExpansion(snapshot.themes)

    return NextResponse.json({ snapshot, analysis })
  } catch (error) {
    console.error("Theme radar analysis failed:", error)
    return NextResponse.json(
      { error: "Failed to analyze themes" },
      { status: 500 }
    )
  }
}

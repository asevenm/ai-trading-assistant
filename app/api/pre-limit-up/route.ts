import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { scanPreLimitUp } from "@/lib/pre-limit-up-api"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const candidates = await scanPreLimitUp()
    return NextResponse.json({
      total: candidates.length,
      candidates,
      scannedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Pre-limit-up scan failed:", error)
    return NextResponse.json(
      { error: "Failed to scan pre-limit-up stocks" },
      { status: 500 }
    )
  }
}

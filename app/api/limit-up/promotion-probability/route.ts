import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { scoreLimitUpPromotions } from "@/lib/ai/promotion-probability"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const scores = await scoreLimitUpPromotions()
    return NextResponse.json({ scores })
  } catch (error) {
    console.error("promotion probability error:", error)
    return NextResponse.json({ error: "Failed to score promotions" }, { status: 500 })
  }
}

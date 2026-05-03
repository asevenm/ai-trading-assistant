import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { findCousinStocks } from "@/lib/cousin-finder"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { code } = await params
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid stock code" }, { status: 400 })
  }

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 20))
  const maxChangePercent = Number(url.searchParams.get("maxChange")) || 5

  try {
    const report = await findCousinStocks(code, { limit, maxChangePercent })
    if (!report) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 })
    }
    return NextResponse.json(report)
  } catch (error) {
    console.error("cousin radar error:", error)
    return NextResponse.json({ error: "Failed to find cousins" }, { status: 500 })
  }
}

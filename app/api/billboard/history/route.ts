import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBillboardHistory } from "@/lib/billboard-api"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get("days") || "5")

  const stocks = await getBillboardHistory(days)
  return NextResponse.json(stocks)
}

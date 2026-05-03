import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTodayBillboard } from "@/lib/billboard-api"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stocks = await getTodayBillboard()
  return NextResponse.json(stocks)
}

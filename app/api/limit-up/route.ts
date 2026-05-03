import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getLimitUpSummary, getLimitDownStocks } from "@/lib/limit-up-api"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [summary, limitDown] = await Promise.all([
    getLimitUpSummary(),
    getLimitDownStocks(),
  ])

  return NextResponse.json({
    limitUp: summary,
    limitDown: {
      total: limitDown.length,
      stocks: limitDown,
    },
  })
}

import { NextRequest, NextResponse } from "next/server"
import {
  getOrderBook,
  getCapitalFlowSummary,
  getCapitalFlowIntraday,
  getCapitalFlowHistory,
  getTransactions,
  getDDEData,
} from "@/lib/level2-api"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get("action")
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 })
  }

  switch (action) {
    case "orderbook": {
      const data = await getOrderBook(code)
      return NextResponse.json(data)
    }

    case "capital-summary": {
      const data = await getCapitalFlowSummary(code)
      return NextResponse.json(data)
    }

    case "capital-intraday": {
      const data = await getCapitalFlowIntraday(code)
      return NextResponse.json(data)
    }

    case "capital-history": {
      const days = parseInt(searchParams.get("days") || "30", 10)
      const data = await getCapitalFlowHistory(code, days)
      return NextResponse.json(data)
    }

    case "transactions": {
      const pos = parseInt(searchParams.get("pos") || "-50", 10)
      const data = await getTransactions(code, pos)
      return NextResponse.json(data)
    }

    case "dde": {
      const data = await getDDEData(code)
      return NextResponse.json(data)
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }
}

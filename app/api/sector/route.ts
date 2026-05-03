import { NextRequest, NextResponse } from "next/server"
import {
  getSectorQuote,
  getSectorKline,
  getSectorMembers,
  getSectorCapitalFlowIntraday,
} from "@/lib/sector-api"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get("action")
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 })
  }

  switch (action) {
    case "quote": {
      const data = await getSectorQuote(code)
      return NextResponse.json(data)
    }

    case "kline": {
      const period = (searchParams.get("period") || "daily") as
        | "daily"
        | "weekly"
        | "monthly"
      const count = parseInt(searchParams.get("count") || "120", 10)
      const data = await getSectorKline(code, period, count)
      return NextResponse.json(data)
    }

    case "members": {
      const count = parseInt(searchParams.get("count") || "100", 10)
      const data = await getSectorMembers(code, count)
      return NextResponse.json(data)
    }

    case "capital-intraday": {
      const data = await getSectorCapitalFlowIntraday(code)
      return NextResponse.json(data)
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }
}

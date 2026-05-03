import { NextRequest, NextResponse } from "next/server";
import { searchStocks, getMultipleQuotes, getKlineData, getTimelineData } from "@/lib/stock-api";
import type { KlinePeriod } from "@/lib/stock-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  if (action === "search") {
    const keyword = searchParams.get("keyword");
    if (!keyword) {
      return NextResponse.json([]);
    }
    const results = await searchStocks(keyword);
    return NextResponse.json(results);
  }

  if (action === "quotes") {
    const codes = searchParams.get("codes");
    if (!codes) {
      return NextResponse.json({});
    }
    const codeList = codes.split(",");
    const quotes = await getMultipleQuotes(codeList);
    return NextResponse.json(Object.fromEntries(quotes));
  }

  if (action === "kline") {
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }
    const period = (searchParams.get("period") || "daily") as KlinePeriod;
    const limit = parseInt(searchParams.get("limit") || "120", 10);
    const data = await getKlineData(code, period, limit);
    return NextResponse.json(data);
  }

  if (action === "timeline") {
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }
    const data = await getTimelineData(code);
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

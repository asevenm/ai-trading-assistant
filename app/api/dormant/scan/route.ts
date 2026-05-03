import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { scanDormantStocks } from "@/lib/ai/dormant-scanner"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const topN = Math.max(5, Math.min(100, Number(url.searchParams.get("topN")) || 30))
  const maxMarketCapYi = Number(url.searchParams.get("maxMarketCap")) || 200
  const maxAmplitude30d = Number(url.searchParams.get("maxAmp")) || 15

  try {
    const stocks = await scanDormantStocks({
      maxMarketCap: maxMarketCapYi * 1e8,
      maxAmplitude30d,
      topN,
    })
    return NextResponse.json({ stocks, total: stocks.length })
  } catch (error) {
    console.error("dormant scan error:", error)
    return NextResponse.json({ error: "Scan failed" }, { status: 500 })
  }
}

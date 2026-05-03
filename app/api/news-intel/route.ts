import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getStockAnnouncements, getMarketNews } from "@/lib/news-api"
import {
  analyzeAnnouncements,
  analyzeNews,
  type NewsAnalysis,
} from "@/lib/ai/news-analyzer"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const watchlist = await prisma.stock.findMany({
      where: { userId: session.user.id },
      select: { code: true },
    })

    const [announcements, news] = await Promise.all([
      getStockAnnouncements(watchlist.map((s) => s.code), 3),
      getMarketNews(30),
    ])

    return NextResponse.json({
      announcements,
      news,
      scannedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("News intel fetch failed:", error)
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const analyzeType = String(body?.type ?? "all")

    const watchlist = await prisma.stock.findMany({
      where: { userId: session.user.id },
      select: { code: true },
    })

    const [announcements, news] = await Promise.all([
      getStockAnnouncements(watchlist.map((s) => s.code), 3),
      getMarketNews(30),
    ])

    const [annMap, newsMap] = await Promise.all([
      analyzeType === "news" ? Promise.resolve(new Map()) : analyzeAnnouncements(announcements),
      analyzeType === "announcement" ? Promise.resolve(new Map()) : analyzeNews(news),
    ])

    // 合并原始数据 + 分析结果
    const analyzedAnnouncements = announcements.map((a) => ({
      ...a,
      analysis: (annMap.get(a.id) ?? null) as NewsAnalysis | null,
    }))
    const analyzedNews = news.map((n) => ({
      ...n,
      analysis: (newsMap.get(n.id) ?? null) as NewsAnalysis | null,
    }))

    return NextResponse.json({
      announcements: analyzedAnnouncements,
      news: analyzedNews,
      scannedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("News intel analysis failed:", error)
    return NextResponse.json(
      { error: "Failed to analyze news" },
      { status: 500 }
    )
  }
}

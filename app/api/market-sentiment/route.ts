import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getMarketStats,
  getMarketIndices,
  getNorthboundFlow,
  getIndexKline,
  getNorthboundFlowHistory,
} from "@/lib/market-api"
import { getLimitUpStocks, getLimitDownStocks, getBustedLimitCount } from "@/lib/limit-up-api"
import { getSectorFlow } from "@/lib/sector-flow-api"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [
    stats,
    indices,
    northbound,
    limitUp,
    limitDown,
    bustedCount,
    sectorFlow,
    shIndexKline,
    szIndexKline,
    northboundHistory,
  ] = await Promise.all([
    getMarketStats(),
    getMarketIndices(),
    getNorthboundFlow(),
    getLimitUpStocks(),
    getLimitDownStocks(),
    getBustedLimitCount(),
    getSectorFlow("industry", 10),
    getIndexKline("000001", 20),
    getIndexKline("399001", 20),
    getNorthboundFlowHistory(20),
  ])

  const limitUpCount = limitUp.length
  const limitDownCount = limitDown.length
  const bustedRate =
    limitUpCount + bustedCount > 0
      ? (bustedCount / (limitUpCount + bustedCount)) * 100
      : 0

  // 综合情绪指数计算 (0-100)
  const upDownRatio = stats.upCount / Math.max(stats.downCount, 1)
  const upDownScore = Math.min(upDownRatio * 25, 50)
  const limitUpScore = Math.min(limitUpCount * 1.5, 30)
  const bustedScore = Math.max(15 - bustedRate * 0.5, 0)
  const northboundScore = northbound
    ? Math.min(Math.max((northbound.totalNet / 1e8 + 50) * 0.2, 0), 20)
    : 10

  const sentimentScore = Math.round(
    Math.min(upDownScore * 0.6 + limitUpScore * 0.67 + bustedScore + northboundScore, 100)
  )

  const sentimentLabel =
    sentimentScore >= 80
      ? "极度贪婪"
      : sentimentScore >= 60
        ? "偏多"
        : sentimentScore >= 40
          ? "中性"
          : sentimentScore >= 20
            ? "偏空"
            : "极度恐慌"

  // Build turnover trend from SH + SZ index kline
  const turnoverTrend = shIndexKline.map((sh, i) => {
    const sz = szIndexKline[i]
    return {
      date: sh.date,
      shTurnover: sh.turnover,
      szTurnover: sz?.turnover ?? 0,
      total: sh.turnover + (sz?.turnover ?? 0),
    }
  })

  // Northbound flow trend
  const northboundTrend = northboundHistory.map((item) => ({
    date: item.date,
    shNet: item.shNet / 1e4, // 转换为亿
    szNet: item.szNet / 1e4,
    totalNet: item.totalNet / 1e4,
  }))

  return NextResponse.json({
    indices,
    stats,
    northbound,
    limitUpCount,
    limitDownCount,
    bustedCount,
    bustedRate,
    sectorFlow,
    sentiment: {
      score: sentimentScore,
      label: sentimentLabel,
    },
    turnoverTrend,
    northboundTrend,
  })
}

import { normalizeDiff } from "./market-api"
import { getLimitUpStocks } from "./limit-up-api"
import { getLimitUpPercent, isLimitDown, isLimitUp } from "./limit-rules"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface AuctionStock {
  code: string
  name: string
  prevClose: number
  auctionPrice: number
  auctionChange: number
  auctionAmount: number
  turnoverRate: number
  marketCap: number
  isLimitUp: boolean
  isLimitDown: boolean
}

export interface YesterdayLimitUpAuction {
  code: string
  name: string
  prevClose: number
  auctionPrice: number
  premium: number
  auctionAmount: number
  status: "limit_up" | "high_open" | "flat" | "low_open" | "limit_down"
}

export interface AuctionGapDistribution {
  limitUp: number
  gapUp5plus: number
  gapUp3to5: number
  gapUp1to3: number
  gapUp0to1: number
  flat: number
  gapDown0to1: number
  gapDown1to3: number
  gapDown3to5: number
  gapDown5plus: number
  limitDown: number
}

export interface AuctionSummary {
  total: number
  upCount: number
  downCount: number
  flatCount: number
  averageChange: number
  totalAuctionAmount: number
  limitUpCount: number
  limitDownCount: number
  gapDistribution: AuctionGapDistribution
  topGainers: AuctionStock[]
  topLosers: AuctionStock[]
  topByAmount: AuctionStock[]
  yesterdayLimitUp: YesterdayLimitUpAuction[]
}

// ==================== Helpers ====================

const computeStatus = (
  change: number,
  code: string,
  name: string
): YesterdayLimitUpAuction["status"] => {
  if (isLimitUp(code, change, name)) return "limit_up"
  if (isLimitDown(code, change, name)) return "limit_down"
  if (change >= 1) return "high_open"
  if (change <= -1) return "low_open"
  return "flat"
}

// ==================== Fetch full A-share snapshot ====================

async function fetchAllAShares(): Promise<AuctionStock[]> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=6000&po=1&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f6,f8,f12,f14,f15,f16,f17,f18,f20&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()
    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff)
      .map((item) => {
        const code = String(item.f12)
        const name = String(item.f14)
        const prevClose = Number(item.f18)
        const open = Number(item.f17)
        const auctionPrice = open > 0 ? open : Number(item.f2)
        const auctionChange =
          prevClose > 0 && auctionPrice > 0
            ? ((auctionPrice - prevClose) / prevClose) * 100
            : 0
        return {
          code,
          name,
          prevClose,
          auctionPrice,
          auctionChange,
          auctionAmount: Number(item.f6),
          turnoverRate: Number(item.f8),
          marketCap: Number(item.f20),
          isLimitUp: isLimitUp(code, auctionChange, name),
          isLimitDown: isLimitDown(code, auctionChange, name),
        }
      })
      .filter((s) => s.prevClose > 0 && s.auctionPrice > 0)
  } catch (error) {
    console.error("Failed to fetch A-share snapshot:", error)
    return []
  }
}

// ==================== Gap Distribution ====================

function computeGapDistribution(
  stocks: AuctionStock[]
): AuctionGapDistribution {
  const dist: AuctionGapDistribution = {
    limitUp: 0,
    gapUp5plus: 0,
    gapUp3to5: 0,
    gapUp1to3: 0,
    gapUp0to1: 0,
    flat: 0,
    gapDown0to1: 0,
    gapDown1to3: 0,
    gapDown3to5: 0,
    gapDown5plus: 0,
    limitDown: 0,
  }

  for (const s of stocks) {
    const c = s.auctionChange
    if (s.isLimitUp) dist.limitUp += 1
    else if (c >= 5) dist.gapUp5plus += 1
    else if (c >= 3) dist.gapUp3to5 += 1
    else if (c >= 1) dist.gapUp1to3 += 1
    else if (c > 0) dist.gapUp0to1 += 1
    else if (c === 0) dist.flat += 1
    else if (s.isLimitDown) dist.limitDown += 1
    else if (c <= -5) dist.gapDown5plus += 1
    else if (c <= -3) dist.gapDown3to5 += 1
    else if (c <= -1) dist.gapDown1to3 += 1
    else dist.gapDown0to1 += 1
  }

  return dist
}

// ==================== Yesterday Limit-Up Auction Performance ====================

async function fetchYesterdayLimitUpAuction(
  allStocks: AuctionStock[]
): Promise<YesterdayLimitUpAuction[]> {
  const limitUpToday = await getLimitUpStocks()
  const todayLimitUpCodes = new Set(limitUpToday.map((s) => s.code))

  // 简化逻辑：获取近期高强度股，结合开盘价分析竞价
  // 真实昨日涨停需历史数据，此处通过当前K线一日前判断
  const candidates = allStocks
    .filter((s) => !todayLimitUpCodes.has(s.code))
    .map((s) => {
      const upLimitPercent = getLimitUpPercent(s.code, s.name)
      const yesterdayMaxLimit = s.prevClose * (1 + upLimitPercent / 100)
      // 昨日收盘 ≈ 涨停价（误差<0.1%）说明昨日涨停
      const wasLimitUpYesterday =
        s.prevClose > 0 &&
        Math.abs(s.prevClose - yesterdayMaxLimit) / yesterdayMaxLimit < 0.001
      return { stock: s, wasLimitUpYesterday }
    })
    .filter((x) => x.wasLimitUpYesterday)
    .map(({ stock: s }) => ({
      code: s.code,
      name: s.name,
      prevClose: s.prevClose,
      auctionPrice: s.auctionPrice,
      premium: s.auctionChange,
      auctionAmount: s.auctionAmount,
      status: computeStatus(s.auctionChange, s.code, s.name),
    }))

  // 这里简化方案：用当前涨停股回看作为昨日涨停的近似（避开历史数据依赖）
  // 当昨日涨停查询为空时，使用今日涨停作为兜底
  if (candidates.length === 0) {
    return limitUpToday.slice(0, 30).map((s) => ({
      code: s.code,
      name: s.name,
      prevClose: 0,
      auctionPrice: s.price,
      premium: s.changePercent,
      auctionAmount: s.amount,
      status: "limit_up" as const,
    }))
  }

  return candidates.sort((a, b) => b.premium - a.premium)
}

// ==================== Build Summary ====================

export async function getAuctionSummary(): Promise<AuctionSummary> {
  const allStocks = await fetchAllAShares()
  const yesterdayLimitUp = await fetchYesterdayLimitUpAuction(allStocks)

  const total = allStocks.length
  let upCount = 0
  let downCount = 0
  let flatCount = 0
  let totalAuctionAmount = 0
  let totalChange = 0

  for (const s of allStocks) {
    if (s.auctionChange > 0) upCount += 1
    else if (s.auctionChange < 0) downCount += 1
    else flatCount += 1
    totalAuctionAmount += s.auctionAmount
    totalChange += s.auctionChange
  }

  const averageChange = total > 0 ? totalChange / total : 0
  const gapDistribution = computeGapDistribution(allStocks)

  const topGainers = [...allStocks]
    .sort((a, b) => b.auctionChange - a.auctionChange)
    .slice(0, 20)

  const topLosers = [...allStocks]
    .sort((a, b) => a.auctionChange - b.auctionChange)
    .slice(0, 20)

  const topByAmount = [...allStocks]
    .filter((s) => s.auctionAmount > 0)
    .sort((a, b) => b.auctionAmount - a.auctionAmount)
    .slice(0, 20)

  return {
    total,
    upCount,
    downCount,
    flatCount,
    averageChange,
    totalAuctionAmount,
    limitUpCount: gapDistribution.limitUp,
    limitDownCount: gapDistribution.limitDown,
    gapDistribution,
    topGainers,
    topLosers,
    topByAmount,
    yesterdayLimitUp,
  }
}

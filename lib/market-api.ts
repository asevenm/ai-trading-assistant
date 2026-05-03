export function normalizeDiff(diff: unknown): Record<string, number | string>[] {
  if (Array.isArray(diff)) return diff
  if (diff && typeof diff === "object") return Object.values(diff)
  return []
}

import { getSecId } from "./stock-api"
import { isLimitUp, isLimitDown } from "./limit-rules"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface MarketIndex {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  turnover: number
}

export interface SectorData {
  code: string
  name: string
  changePercent: number
  leadingStock: string
  leadingStockChange: number
  turnover: number
}

export interface MarketStats {
  upCount: number
  downCount: number
  flatCount: number
  limitUpCount: number
  limitDownCount: number
  totalTurnover: number
}

export interface NorthboundFlow {
  shBuy: number
  shSell: number
  shNet: number
  szBuy: number
  szSell: number
  szNet: number
  totalNet: number
  date: string
}

export interface KlineItem {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  turnover: number
  changePercent: number
}

// ==================== Market Indices ====================

const INDEX_SECIDS: Record<string, string> = {
  "000001": "1.000001", // 上证指数
  "399001": "0.399001", // 深证成指
  "399006": "0.399006", // 创业板指
  "000688": "1.000688", // 科创50
}

export async function getMarketIndices(): Promise<MarketIndex[]> {
  try {
    const secids = Object.values(INDEX_SECIDS).join(",")
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f1,f2,f3,f4,f6,f12,f14,f104,f105,f106&secids=${secids}&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map(
      (item) => ({
        code: String(item.f12),
        name: String(item.f14),
        price: Number(item.f2),
        change: Number(item.f4),
        changePercent: Number(item.f3),
        volume: Number(item.f104) + Number(item.f105) + Number(item.f106),
        turnover: Number(item.f6),
      })
    )
  } catch (error) {
    console.error("Failed to fetch market indices:", error)
    return []
  }
}

// ==================== Sector Ranking ====================

export async function getSectorRanking(
  type: "industry" | "concept" = "industry",
  count: number = 20
): Promise<SectorData[]> {
  try {
    // 行业板块 fs=m:90+t:2, 概念板块 fs=m:90+t:3
    const fs = type === "industry" ? "m:90+t:2" : "m:90+t:3"
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${count}&fs=${fs}&fields=f2,f3,f4,f12,f14,f128,f136,f140&fid=f3&po=1&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map(
      (item) => ({
        code: String(item.f12),
        name: String(item.f14),
        changePercent: Number(item.f3),
        leadingStock: String(item.f140 || ""),
        leadingStockChange: Number(item.f136),
        turnover: Number(item.f2),
      })
    )
  } catch (error) {
    console.error("Failed to fetch sector ranking:", error)
    return []
  }
}

// ==================== Market Stats ====================

export async function getMarketStats(): Promise<MarketStats> {
  try {
    // 涨跌家数：用 1.000001(上证综指) + 0.399106(深证综指) + 0.899050(北证50) 的 f104/f105/f106
    // 这三个指数的 f104/f105/f106 字段会聚合各自交易所全市场（非仅成分股）的涨跌平家数
    // 比 clist 的 fl=f3>0 过滤器可靠（fl 在服务端被忽略，曾导致全市场计数）
    const indicesUrl = `https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f12,f104,f105,f106&secids=1.000001,0.399106,0.899050&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    // 涨停/跌停：按 f3 排序取前 200 条，客户端按板块阈值过滤（fl 服务端不生效，靠排序保证覆盖）
    // 包含 北交所 m:0+t:81 (±30%)
    const buildLimitUrl = (po: 0 | 1) =>
      `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=200&po=${po}&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:81,m:1+t:2,m:1+t:23&fields=f3,f12,f14&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b`

    // 总成交额：从 ulist.np 取 SH+SZ+BSE 综指的 f6
    const turnoverUrl = `https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f6,f12&secids=1.000001,0.399106,0.899050&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const [indicesRes, limitUpRes, limitDownRes, turnoverRes] = await Promise.all([
      fetch(indicesUrl, { headers: EAST_MONEY_HEADERS, cache: "no-store" }),
      fetch(buildLimitUrl(1), { headers: EAST_MONEY_HEADERS, cache: "no-store" }),
      fetch(buildLimitUrl(0), { headers: EAST_MONEY_HEADERS, cache: "no-store" }),
      fetch(turnoverUrl, { headers: EAST_MONEY_HEADERS, cache: "no-store" }),
    ])

    const [indicesJson, limitUpJson, limitDownJson, turnoverJson] = await Promise.all([
      indicesRes.json(),
      limitUpRes.json(),
      limitDownRes.json(),
      turnoverRes.json(),
    ])

    const indexRows = normalizeDiff(indicesJson.data?.diff)
    const upCount = indexRows.reduce((sum, row) => sum + Number(row.f104 || 0), 0)
    const downCount = indexRows.reduce((sum, row) => sum + Number(row.f105 || 0), 0)
    const flatCount = indexRows.reduce((sum, row) => sum + Number(row.f106 || 0), 0)

    const limitUpCount = normalizeDiff(limitUpJson.data?.diff).filter((item) =>
      isLimitUp(String(item.f12), Number(item.f3), String(item.f14 || ""))
    ).length

    const limitDownCount = normalizeDiff(limitDownJson.data?.diff).filter((item) =>
      isLimitDown(String(item.f12), Number(item.f3), String(item.f14 || ""))
    ).length

    const totalTurnover = normalizeDiff(turnoverJson.data?.diff).reduce(
      (sum, row) => sum + Number(row.f6 || 0),
      0
    )

    return {
      upCount,
      downCount,
      flatCount,
      limitUpCount,
      limitDownCount,
      totalTurnover,
    }
  } catch (error) {
    console.error("Failed to fetch market stats:", error)
    return {
      upCount: 0,
      downCount: 0,
      flatCount: 0,
      limitUpCount: 0,
      limitDownCount: 0,
      totalTurnover: 0,
    }
  }
}

// ==================== Northbound Flow ====================

export async function getNorthboundFlow(): Promise<NorthboundFlow | null> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/kamtbs.wss/get?fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      next: { revalidate: 60 },
    })
    const result = await response.json()

    if (!result.data) return null

    const d = result.data
    return {
      shBuy: Number(d.f1 || 0),
      shSell: Number(d.f2 || 0),
      shNet: Number(d.f5 || 0),
      szBuy: Number(d.f3 || 0),
      szSell: Number(d.f4 || 0),
      szNet: Number(d.f6 || 0),
      totalNet: Number(d.f5 || 0) + Number(d.f6 || 0),
      date: new Date().toISOString().split("T")[0],
    }
  } catch (error) {
    console.error("Failed to fetch northbound flow:", error)
    return null
  }
}

// ==================== K-Line Data ====================

export async function getStockKline(
  code: string,
  period: "daily" | "weekly" | "monthly" = "daily",
  count: number = 120
): Promise<KlineItem[]> {
  try {
    const secid = getSecId(code)
    const klt = period === "daily" ? "101" : period === "weekly" ? "102" : "103"

    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${klt}&fqt=1&end=20500101&lmt=${count}`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      next: { revalidate: 60 },
    })
    const result = await response.json()

    if (!result.data?.klines) return []

    return result.data.klines.map((line: string) => {
      const parts = line.split(",")
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseInt(parts[5]),
        turnover: parseFloat(parts[6]),
        changePercent: parseFloat(parts[8]),
      }
    })
  } catch (error) {
    console.error("Failed to fetch kline:", error)
    return []
  }
}

// ==================== Stock Ranking ====================

export async function getStockRanking(
  sortField: "f3" | "f8" | "f10" = "f3",
  count: number = 50,
  ascending: boolean = false
): Promise<
  {
    code: string
    name: string
    price: number
    changePercent: number
    volume: number
    turnoverRate: number
    pe: number
    marketCap: number
  }[]
> {
  try {
    const po = ascending ? 0 : 1
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${count}&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f20&fid=${sortField}&po=${po}&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map(
      (item) => ({
        code: String(item.f12),
        name: String(item.f14),
        price: Number(item.f2),
        changePercent: Number(item.f3),
        volume: Number(item.f5),
        turnoverRate: Number(item.f8),
        pe: Number(item.f9),
        marketCap: Number(item.f20),
      })
    )
  } catch (error) {
    console.error("Failed to fetch stock ranking:", error)
    return []
  }
}

// ==================== Index Kline (for turnover trends) ====================

export interface IndexKlineItem {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  turnover: number
  changePercent: number
}

export async function getIndexKline(
  indexCode: string = "000001",
  days: number = 20
): Promise<IndexKlineItem[]> {
  try {
    const market = indexCode.startsWith("3") ? "0" : "1"
    const secid = `${market}.${indexCode}`
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=${days}&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.klines) return []

    return result.data.klines.map((line: string) => {
      const parts = line.split(",")
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseInt(parts[5]),
        turnover: parseFloat(parts[6]),
        changePercent: parseFloat(parts[8]),
      }
    })
  } catch (error) {
    console.error("Failed to fetch index kline:", error)
    return []
  }
}

// ==================== Northbound Flow History ====================

export interface NorthboundHistoryItem {
  date: string
  shNet: number
  szNet: number
  totalNet: number
}

export async function getNorthboundFlowHistory(
  days: number = 20
): Promise<NorthboundHistoryItem[]> {
  try {
    const url = `https://push2his.eastmoney.com/api/qt/kamt.kline/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56&klt=101&lmt=${days}&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.s2n) return []

    return result.data.s2n
      .filter((line: string) => line && !line.startsWith("-"))
      .slice(-days)
      .map((line: string) => {
        const parts = line.split(",")
        return {
          date: parts[0],
          shNet: parseFloat(parts[1]) || 0,
          szNet: parseFloat(parts[2]) || 0,
          totalNet: parseFloat(parts[3]) || 0,
        }
      })
  } catch (error) {
    console.error("Failed to fetch northbound flow history:", error)
    return []
  }
}

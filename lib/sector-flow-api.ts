import { normalizeDiff } from "./market-api"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface SectorFlow {
  code: string
  name: string
  changePercent: number
  mainNetInflow: number // 主力净流入(元)
  superLargeInflow: number // 超大单净流入
  largeInflow: number // 大单净流入
  mediumInflow: number // 中单净流入
  smallInflow: number // 小单净流入
}

export interface StockFlow {
  code: string
  name: string
  price: number
  changePercent: number
  mainNetInflow: number
  mainNetInflowPercent: number // 主力净占比
}

// ==================== Sector Fund Flow ====================

export async function getSectorFlow(
  type: "industry" | "concept" = "industry",
  count: number = 30
): Promise<SectorFlow[]> {
  try {
    const fs = type === "industry" ? "m:90+t:2" : "m:90+t:3"
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${count}&po=1&fid=f62&fs=${fs}&fields=f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map((item) => ({
      code: String(item.f12),
      name: String(item.f14),
      changePercent: Number(item.f3),
      mainNetInflow: Number(item.f62),
      superLargeInflow: Number(item.f66),
      largeInflow: Number(item.f72),
      mediumInflow: Number(item.f78),
      smallInflow: Number(item.f84),
    }))
  } catch (error) {
    console.error("Failed to fetch sector flow:", error)
    return []
  }
}

// ==================== Stock Fund Flow Top ====================

export async function getStockFlowTop(count: number = 20): Promise<StockFlow[]> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${count}&po=1&fid=f62&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f2,f3,f62,f184,f66,f69,f72,f75&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map((item) => ({
      code: String(item.f12),
      name: String(item.f14),
      price: Number(item.f2),
      changePercent: Number(item.f3),
      mainNetInflow: Number(item.f62),
      mainNetInflowPercent: Number(item.f184),
    }))
  } catch (error) {
    console.error("Failed to fetch stock flow:", error)
    return []
  }
}

// ==================== Sector Daily Flow History (近 N 日每日资金流) ====================

export interface SectorFlowDaily {
  date: string
  mainNet: number
  smallNet: number
  mediumNet: number
  largeNet: number
  superLargeNet: number
}

export async function getSectorFlowDaily(
  code: string,
  days: number = 5
): Promise<SectorFlowDaily[]> {
  try {
    const secid = `90.${code}`
    // klt=101 日线; fields2 顺序: f51 日期, f52 主力, f53 小单, f54 中单, f55 大单, f56 超大单
    const url =
      `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get` +
      `?secid=${secid}` +
      `&fields1=f1,f2,f3,f7` +
      `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65` +
      `&klt=101` +
      `&lmt=${days}` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      next: { revalidate: 300 },
    })
    const result = await response.json()

    if (!result.data?.klines) return []

    return (result.data.klines as string[]).map((line) => {
      const parts = line.split(",")
      return {
        date: parts[0],
        mainNet: parseFloat(parts[1]) || 0,
        smallNet: parseFloat(parts[2]) || 0,
        mediumNet: parseFloat(parts[3]) || 0,
        largeNet: parseFloat(parts[4]) || 0,
        superLargeNet: parseFloat(parts[5]) || 0,
      }
    })
  } catch (error) {
    console.error("Failed to fetch sector daily flow:", error)
    return []
  }
}

// ==================== Sector Weekly Trend (近一周每日排行) ====================

export interface SectorFlowTrendItem {
  code: string
  name: string
  changePercent: number
  daily: { date: string; mainNet: number }[]
  totalNet: number
  positiveDays: number
}

export async function getSectorFlowTrend(
  type: "industry" | "concept" = "industry",
  days: number = 5,
  count: number = 15
): Promise<{ dates: string[]; sectors: SectorFlowTrendItem[] }> {
  try {
    // 候选池：当前主力净流入 Top N 与净流出 Top N 合并去重，覆盖近期强弱两端
    const [inflowTop, outflowTop] = await Promise.all([
      getSectorFlow(type, count),
      getSectorFlowOutflow(type, Math.floor(count / 2)),
    ])

    const merged = new Map<string, { code: string; name: string; changePercent: number }>()
    for (const s of [...inflowTop, ...outflowTop]) {
      if (!merged.has(s.code)) {
        merged.set(s.code, {
          code: s.code,
          name: s.name,
          changePercent: s.changePercent,
        })
      }
    }
    const candidates = Array.from(merged.values())

    const histories = await Promise.all(
      candidates.map((s) => getSectorFlowDaily(s.code, days))
    )

    // 取并集日期，按升序排列
    const dateSet = new Set<string>()
    for (const h of histories) for (const d of h) dateSet.add(d.date)
    const dates = Array.from(dateSet).sort().slice(-days)

    const items: SectorFlowTrendItem[] = candidates.map((s, i) => {
      const map = new Map(histories[i].map((d) => [d.date, d.mainNet]))
      const daily = dates.map((date) => ({ date, mainNet: map.get(date) ?? 0 }))
      const totalNet = daily.reduce((sum, d) => sum + d.mainNet, 0)
      const positiveDays = daily.filter((d) => d.mainNet > 0).length
      return {
        code: s.code,
        name: s.name,
        changePercent: s.changePercent,
        daily,
        totalNet,
        positiveDays,
      }
    })

    items.sort((a, b) => b.totalNet - a.totalNet)
    return { dates, sectors: items.slice(0, count) }
  } catch (error) {
    console.error("Failed to fetch sector flow trend:", error)
    return { dates: [], sectors: [] }
  }
}

// ==================== Sector Flow Outflow (净流出排行) ====================

export async function getSectorFlowOutflow(
  type: "industry" | "concept" = "industry",
  count: number = 20
): Promise<SectorFlow[]> {
  try {
    const fs = type === "industry" ? "m:90+t:2" : "m:90+t:3"
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${count}&po=0&fid=f62&fs=${fs}&fields=f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map((item) => ({
      code: String(item.f12),
      name: String(item.f14),
      changePercent: Number(item.f3),
      mainNetInflow: Number(item.f62),
      superLargeInflow: Number(item.f66),
      largeInflow: Number(item.f72),
      mediumInflow: Number(item.f78),
      smallInflow: Number(item.f84),
    }))
  } catch (error) {
    console.error("Failed to fetch sector flow outflow:", error)
    return []
  }
}

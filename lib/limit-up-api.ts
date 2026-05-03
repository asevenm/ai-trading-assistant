import { normalizeDiff } from "./market-api"
import { getLimitUpPrice, isLimitDown, isLimitUp } from "./limit-rules"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface LimitUpStock {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  amount: number // 成交额
  circulationMarketCap: number // 流通市值
  industry: string
}

export interface LimitUpSummary {
  total: number
  stocks: LimitUpStock[]
  byBoard: {
    first: LimitUpStock[] // 首板
    second: LimitUpStock[] // 二板
    third: LimitUpStock[] // 三板+
  }
  bustedCount: number // 炸板数
  bustedRate: number // 炸板率
}

export interface LimitDownStock {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
}

// ==================== Limit Up Stocks ====================

export async function getLimitUpStocks(): Promise<LimitUpStock[]> {
  try {
    // 先用东财服务端 fl=f3>=9.9 拉取所有涨幅>=9.9% 的股票，
    // 客户端再按板块阈值二次过滤（主板10%/创业板20%/科创板20%/北交所30%/ST5%）
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=200&po=1&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f5,f6,f8,f12,f14,f15,f17,f20,f100&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b&fl=f3>=9.9`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff)
      .filter((item) =>
        isLimitUp(String(item.f12), Number(item.f3), String(item.f14 || ""))
      )
      .map((item) => ({
        code: String(item.f12),
        name: String(item.f14),
        price: Number(item.f2),
        changePercent: Number(item.f3),
        turnoverRate: Number(item.f8),
        amount: Number(item.f6),
        circulationMarketCap: Number(item.f20),
        industry: String(item.f100 || ""),
      }))
  } catch (error) {
    console.error("Failed to fetch limit up stocks:", error)
    return []
  }
}

// ==================== Limit Down Stocks ====================

export async function getLimitDownStocks(): Promise<LimitDownStock[]> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=200&po=0&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f5,f8,f12,f14&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b&fl=f3<=-9.9`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff)
      .filter((item) =>
        isLimitDown(String(item.f12), Number(item.f3), String(item.f14 || ""))
      )
      .map((item) => ({
        code: String(item.f12),
        name: String(item.f14),
        price: Number(item.f2),
        changePercent: Number(item.f3),
        turnoverRate: Number(item.f8),
      }))
  } catch (error) {
    console.error("Failed to fetch limit down stocks:", error)
    return []
  }
}

// ==================== Yesterday Limit Up Premium ====================

export async function getYesterdayLimitUpPremium(): Promise<
  { code: string; name: string; yesterdayClose: number; todayOpen: number; todayChange: number; premium: number }[]
> {
  // 获取昨日涨停股今日表现需要 K线数据
  // 简化实现：通过涨跌幅排序获取近期强势股
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=50&po=1&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f12,f14,f17,f18&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map((item) => ({
      code: String(item.f12),
      name: String(item.f14),
      yesterdayClose: Number(item.f18),
      todayOpen: Number(item.f17),
      todayChange: Number(item.f3),
      premium: Number(item.f17) > 0 && Number(item.f18) > 0
        ? ((Number(item.f17) - Number(item.f18)) / Number(item.f18)) * 100
        : 0,
    }))
  } catch (error) {
    console.error("Failed to fetch premium data:", error)
    return []
  }
}

// ==================== Busted Limit Count ====================

export async function getBustedLimitCount(): Promise<number> {
  try {
    // 曾涨停但收盘未封住的 = 最高价涨停但收盘未涨停
    // 通过 f15(最高价) 和 f2(收盘价) 比较
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=500&po=1&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f12,f14,f15,f18&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return 0

    const items = normalizeDiff(result.data.diff)
    let busted = 0

    for (const item of items) {
      const code = String(item.f12)
      const name = String(item.f14 || "")
      const high = Number(item.f15)
      const close = Number(item.f2)
      const prevClose = Number(item.f18)

      if (prevClose <= 0 || high <= 0) continue

      const limitPrice = getLimitUpPrice(code, prevClose, name)
      const highReachedLimit = high >= limitPrice * 0.999
      const closeNotLimit = close < limitPrice * 0.999

      if (highReachedLimit && closeNotLimit) {
        busted++
      }
    }

    return busted
  } catch (error) {
    console.error("Failed to calculate busted limit count:", error)
    return 0
  }
}

// ==================== Build Summary ====================

export async function getLimitUpSummary(): Promise<LimitUpSummary> {
  const [stocks, bustedCount] = await Promise.all([
    getLimitUpStocks(),
    getBustedLimitCount(),
  ])

  const total = stocks.length
  const bustedRate = total + bustedCount > 0
    ? (bustedCount / (total + bustedCount)) * 100
    : 0

  // 简化连板判断：使用换手率和涨幅推断
  // 真正的连板需要历史数据，这里先按单日分类
  const byBoard = {
    first: stocks.filter((s) => s.changePercent < 11),
    second: [] as LimitUpStock[],
    third: stocks.filter((s) => s.changePercent >= 20),
  }

  return {
    total,
    stocks,
    byBoard,
    bustedCount,
    bustedRate,
  }
}

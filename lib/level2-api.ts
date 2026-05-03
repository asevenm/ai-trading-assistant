import { getSecId } from "./stock-api"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface OrderBookLevel {
  price: number
  volume: number // 手
}

export interface OrderBookData {
  bids: OrderBookLevel[] // 买1-买5
  asks: OrderBookLevel[] // 卖1-卖5
  currentPrice: number
  prevClose: number
}

export interface CapitalFlowPoint {
  time: string
  mainNet: number    // 主力净流入 (元)
  superNet: number   // 超大单净流入
  bigNet: number     // 大单净流入
  midNet: number     // 中单净流入
  smallNet: number   // 小单净流入
}

export interface CapitalFlowSummary {
  mainNet: number
  mainNetPct: number
  superNet: number
  superNetPct: number
  bigNet: number
  bigNetPct: number
  midNet: number
  midNetPct: number
  smallNet: number
  smallNetPct: number
}

export interface CapitalFlowDayItem {
  date: string
  mainNet: number
  superNet: number
  bigNet: number
  midNet: number
  smallNet: number
}

export interface TransactionItem {
  time: string
  price: number
  volume: number  // 手
  type: "buy" | "sell" | "neutral"
}

export interface DDEData {
  ddeNet: number       // DDI 净额 (大单净买入, 元)
  ddeNetPct: number    // DDI 净额占比
  ddeLarge: number     // 大单买入额
  ddeLargeSell: number // 大单卖出额
  ddeRatio: number     // 大单比率 (大单/总成交)
  continuousDays: number // 连续净流入天数
}

// ==================== 5档盘口 ====================

export async function getOrderBook(code: string): Promise<OrderBookData | null> {
  try {
    const secid = getSecId(code)
    // 使用 stock/get 接口获取5档行情
    // 买盘: f11=买1价, f12=买1量 ... f19=买5价, f20=买5量 (需除以100得到真实价格)
    // 卖盘: f31=卖1价, f32=卖1量 ... f39=卖5价, f40=卖5量
    const fields = "f43,f60,f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40"
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2&invt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (result.rc !== 0 || !result.data) return null

    const d = result.data

    const bids: OrderBookLevel[] = [
      { price: Number(d.f11), volume: Number(d.f12) },
      { price: Number(d.f13), volume: Number(d.f14) },
      { price: Number(d.f15), volume: Number(d.f16) },
      { price: Number(d.f17), volume: Number(d.f18) },
      { price: Number(d.f19), volume: Number(d.f20) },
    ]

    const asks: OrderBookLevel[] = [
      { price: Number(d.f31), volume: Number(d.f32) },
      { price: Number(d.f33), volume: Number(d.f34) },
      { price: Number(d.f35), volume: Number(d.f36) },
      { price: Number(d.f37), volume: Number(d.f38) },
      { price: Number(d.f39), volume: Number(d.f40) },
    ]

    return {
      bids,
      asks,
      currentPrice: Number(d.f43),
      prevClose: Number(d.f60),
    }
  } catch (error) {
    console.error("Failed to fetch order book:", error)
    return null
  }
}

// ==================== 实时资金流向概况 ====================

export async function getCapitalFlowSummary(
  code: string
): Promise<CapitalFlowSummary | null> {
  try {
    const secid = getSecId(code)
    // f62=主力净流入, f184=主力净比, f66=超大单净流入, f69=超大单净比
    // f72=大单净流入, f75=大单净比, f78=中单净流入, f81=中单净比
    // f84=小单净流入, f87=小单净比
    const fields = "f62,f184,f66,f69,f72,f75,f78,f81,f84,f87"
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2&invt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (result.rc !== 0 || !result.data) return null

    const d = result.data
    return {
      mainNet: Number(d.f62) || 0,
      mainNetPct: Number(d.f184) || 0,
      superNet: Number(d.f66) || 0,
      superNetPct: Number(d.f69) || 0,
      bigNet: Number(d.f72) || 0,
      bigNetPct: Number(d.f75) || 0,
      midNet: Number(d.f78) || 0,
      midNetPct: Number(d.f81) || 0,
      smallNet: Number(d.f84) || 0,
      smallNetPct: Number(d.f87) || 0,
    }
  } catch (error) {
    console.error("Failed to fetch capital flow summary:", error)
    return null
  }
}

// ==================== 分时资金流向 ====================

export async function getCapitalFlowIntraday(
  code: string
): Promise<CapitalFlowPoint[]> {
  try {
    const secid = getSecId(code)
    const url =
      `https://push2.eastmoney.com/api/qt/stock/fflow/kline/get` +
      `?secid=${secid}` +
      `&fields1=f1,f2,f3,f7` +
      `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65` +
      `&klt=1` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (result.rc !== 0 || !result.data?.klines) return []

    return (result.data.klines as string[]).map((line) => {
      const parts = line.split(",")
      return {
        time: parts[0],
        mainNet: parseFloat(parts[1]) || 0,     // 主力净流入
        smallNet: parseFloat(parts[2]) || 0,     // 小单净流入
        midNet: parseFloat(parts[3]) || 0,       // 中单净流入
        bigNet: parseFloat(parts[4]) || 0,       // 大单净流入
        superNet: parseFloat(parts[5]) || 0,     // 超大单净流入
      }
    })
  } catch (error) {
    console.error("Failed to fetch capital flow intraday:", error)
    return []
  }
}

// ==================== 日级资金流向历史 ====================

export async function getCapitalFlowHistory(
  code: string,
  days: number = 30
): Promise<CapitalFlowDayItem[]> {
  try {
    const secid = getSecId(code)
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
      cache: "no-store",
    })
    const result = await response.json()

    if (result.rc !== 0 || !result.data?.klines) return []

    return (result.data.klines as string[]).map((line) => {
      const parts = line.split(",")
      return {
        date: parts[0],
        mainNet: parseFloat(parts[1]) || 0,
        smallNet: parseFloat(parts[2]) || 0,
        midNet: parseFloat(parts[3]) || 0,
        bigNet: parseFloat(parts[4]) || 0,
        superNet: parseFloat(parts[5]) || 0,
      }
    })
  } catch (error) {
    console.error("Failed to fetch capital flow history:", error)
    return []
  }
}

// ==================== 分时成交明细 ====================

export async function getTransactions(
  code: string,
  pos: number = -30 // 最新30条，负数表示从后往前
): Promise<TransactionItem[]> {
  try {
    const secid = getSecId(code)
    const url =
      `https://push2.eastmoney.com/api/qt/stock/details/get` +
      `?secid=${secid}` +
      `&fields1=f1,f2,f3,f4` +
      `&fields2=f51,f52,f53,f54,f55` +
      `&pos=${pos}` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (result.rc !== 0 || !result.data?.details) return []

    return (result.data.details as string[]).map((line) => {
      const parts = line.split(",")
      const typeCode = parseInt(parts[4]) || 0
      // 1=买盘, 2=卖盘, 4=中性
      const type: "buy" | "sell" | "neutral" =
        typeCode === 1 ? "buy" : typeCode === 2 ? "sell" : "neutral"

      return {
        time: parts[0],
        price: parseFloat(parts[1]) || 0,
        volume: parseInt(parts[2]) || 0,
        type,
      }
    })
  } catch (error) {
    console.error("Failed to fetch transactions:", error)
    return []
  }
}

// ==================== DDE 指标近似 ====================

export async function getDDEData(code: string): Promise<DDEData | null> {
  try {
    const secid = getSecId(code)
    // f62=主力净流入, f184=主力净比, f66=超大单净流入, f72=大单净流入
    // f135=主力买入, f136=主力卖出, f137=超大单买入, f138=超大单卖出
    // f139=大单买入, f140=大单卖出, f141=中单买入, f142=中单卖出
    // f48=成交额
    const fields = "f48,f62,f184,f66,f72,f135,f136,f137,f138,f139,f140,f141,f142"
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2&invt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (result.rc !== 0 || !result.data) return null

    const d = result.data
    const mainBuy = Number(d.f135) || 0
    const mainSell = Number(d.f136) || 0
    const totalAmount = Number(d.f48) || 1

    // 计算连续流入天数
    const history = await getCapitalFlowHistory(code, 10)
    let continuousDays = 0
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].mainNet > 0) {
        continuousDays++
      } else {
        break
      }
    }

    return {
      ddeNet: Number(d.f62) || 0,
      ddeNetPct: Number(d.f184) || 0,
      ddeLarge: mainBuy,
      ddeLargeSell: mainSell,
      ddeRatio: totalAmount > 0 ? ((mainBuy + mainSell) / totalAmount) * 100 : 0,
      continuousDays,
    }
  } catch (error) {
    console.error("Failed to fetch DDE data:", error)
    return null
  }
}

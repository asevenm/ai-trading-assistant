import { normalizeDiff } from "./market-api"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// 板块 secid 统一前缀 90
export function getSectorSecId(code: string): string {
  return `90.${code}`
}

// 板块代码校验: BK 开头 + 4位数字
export function isSectorCode(code: string): boolean {
  return /^BK\d{4}$/i.test(code)
}

// ==================== Types ====================

export interface SectorQuote {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  turnover: number
  upCount: number
  downCount: number
  leadingStock: string
  leadingStockCode: string
  leadingStockChange: number
  mainNetInflow: number
  superLargeInflow: number
  largeInflow: number
  mediumInflow: number
  smallInflow: number
}

export interface SectorKlineItem {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  turnover: number
  changePercent: number
}

export interface SectorMember {
  code: string
  name: string
  price: number
  changePercent: number
  volume: number
  turnover: number
  turnoverRate: number
  mainNetInflow: number
}

// ==================== 板块行情 ====================

export async function getSectorQuote(code: string): Promise<SectorQuote | null> {
  try {
    const secid = getSectorSecId(code)
    // f43=现价, f44=最高, f45=最低, f46=开盘, f47=成交量, f48=成交额
    // f57=代码, f58=名称, f60=昨收, f169=涨跌额, f170=涨跌幅
    // f104=上涨数, f105=下跌数, f106=平家数
    // f128=领涨股名称, f140=领涨股代码, f136=领涨股涨跌幅
    // f62=主力净流入, f66=超大单, f72=大单, f78=中单, f84=小单
    const fields = [
      "f43", "f44", "f45", "f46", "f47", "f48",
      "f57", "f58", "f60", "f169", "f170",
      "f104", "f105", "f106",
      "f128", "f140", "f136",
      "f62", "f66", "f72", "f78", "f84",
    ].join(",")
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2&invt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (result.rc !== 0 || !result.data) return null

    const d = result.data
    return {
      code: String(d.f57 || code),
      name: String(d.f58 || ""),
      price: Number(d.f43) || 0,
      change: Number(d.f169) || 0,
      changePercent: Number(d.f170) || 0,
      volume: Number(d.f47) || 0,
      turnover: Number(d.f48) || 0,
      upCount: Number(d.f104) || 0,
      downCount: Number(d.f105) || 0,
      leadingStock: String(d.f128 || ""),
      leadingStockCode: String(d.f140 || ""),
      leadingStockChange: Number(d.f136) || 0,
      mainNetInflow: Number(d.f62) || 0,
      superLargeInflow: Number(d.f66) || 0,
      largeInflow: Number(d.f72) || 0,
      mediumInflow: Number(d.f78) || 0,
      smallInflow: Number(d.f84) || 0,
    }
  } catch (error) {
    console.error("Failed to fetch sector quote:", error)
    return null
  }
}

// ==================== 板块K线 ====================

export async function getSectorKline(
  code: string,
  period: "daily" | "weekly" | "monthly" = "daily",
  count: number = 120
): Promise<SectorKlineItem[]> {
  try {
    const secid = getSectorSecId(code)
    const klt = period === "daily" ? "101" : period === "weekly" ? "102" : "103"
    const url =
      `https://push2his.eastmoney.com/api/qt/stock/kline/get` +
      `?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6` +
      `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
      `&klt=${klt}&fqt=1&end=20500101&lmt=${count}` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      next: { revalidate: 60 },
    })
    const result = await response.json()

    if (!result.data?.klines) return []

    return (result.data.klines as string[]).map((line) => {
      const parts = line.split(",")
      return {
        date: parts[0],
        open: parseFloat(parts[1]) || 0,
        close: parseFloat(parts[2]) || 0,
        high: parseFloat(parts[3]) || 0,
        low: parseFloat(parts[4]) || 0,
        volume: parseInt(parts[5]) || 0,
        turnover: parseFloat(parts[6]) || 0,
        changePercent: parseFloat(parts[8]) || 0,
      }
    })
  } catch (error) {
    console.error("Failed to fetch sector kline:", error)
    return []
  }
}

// ==================== 板块成分股 ====================

export async function getSectorMembers(
  code: string,
  count: number = 100
): Promise<SectorMember[]> {
  try {
    // fs=b:<板块代码>, fid=f3 按涨跌幅排序，po=1 降序
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get` +
      `?pn=1&pz=${count}&po=1&np=1&fid=f3` +
      `&fs=b:${code}` +
      `&fields=f2,f3,f5,f6,f8,f12,f14,f62` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map((item) => ({
      code: String(item.f12),
      name: String(item.f14),
      price: Number(item.f2) || 0,
      changePercent: Number(item.f3) || 0,
      volume: Number(item.f5) || 0,
      turnover: Number(item.f6) || 0,
      turnoverRate: Number(item.f8) || 0,
      mainNetInflow: Number(item.f62) || 0,
    }))
  } catch (error) {
    console.error("Failed to fetch sector members:", error)
    return []
  }
}

// ==================== 板块分时资金流向 ====================

export interface SectorCapitalFlowPoint {
  time: string
  mainNet: number
  smallNet: number
  midNet: number
  bigNet: number
  superNet: number
}

export async function getSectorCapitalFlowIntraday(
  code: string
): Promise<SectorCapitalFlowPoint[]> {
  try {
    const secid = getSectorSecId(code)
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
        mainNet: parseFloat(parts[1]) || 0,
        smallNet: parseFloat(parts[2]) || 0,
        midNet: parseFloat(parts[3]) || 0,
        bigNet: parseFloat(parts[4]) || 0,
        superNet: parseFloat(parts[5]) || 0,
      }
    })
  } catch (error) {
    console.error("Failed to fetch sector capital flow:", error)
    return []
  }
}

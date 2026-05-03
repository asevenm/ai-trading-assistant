import { normalizeDiff } from "./market-api"
import { getSecId, isHKCode } from "./stock-api"
import {
  distanceToLimitUp,
  getLimitUpPercent,
  isLimitUp,
} from "./limit-rules"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export type AlertType =
  | "price_surge"     // 涨幅突破
  | "price_drop"      // 跌幅突破
  | "volume_surge"    // 成交量放大
  | "near_limit_up"   // 逼近涨停
  | "rapid_rise"      // 快速拉升
  | "rapid_drop"      // 快速跳水
  | "sector_move"     // 板块异动

export interface AlertRuleConfig {
  id: string
  type: AlertType
  threshold: number
  scope: "watchlist" | "market" | "custom"
  stockCodes?: string[]
  enabled: boolean
}

export interface ScanResult {
  type: AlertType
  stockCode: string
  stockName: string
  message: string
  detail: Record<string, unknown>
  currentValue: number
  threshold: number
  ruleId: string
}

export interface StockSnapshot {
  code: string
  name: string
  price: number
  changePercent: number
  volume: number
  turnoverRate: number
  volumeRatio: number  // 量比 (f10): 当前成交量 / 近5日同时段均量
  amount: number
  high: number
  low: number
  open: number
  prevClose: number
}

// ==================== Default Rules ====================

export const DEFAULT_ALERT_RULES: Omit<AlertRuleConfig, "id">[] = [
  { type: "price_surge", threshold: 5, scope: "watchlist", enabled: true },
  { type: "price_drop", threshold: -5, scope: "watchlist", enabled: true },
  { type: "volume_surge", threshold: 3, scope: "watchlist", enabled: true },
  { type: "near_limit_up", threshold: 2, scope: "watchlist", enabled: true },
  { type: "rapid_rise", threshold: 3, scope: "market", enabled: true },
  { type: "rapid_drop", threshold: -3, scope: "market", enabled: true },
  { type: "sector_move", threshold: 3, scope: "market", enabled: true },
]

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  price_surge: "涨幅突破",
  price_drop: "跌幅突破",
  volume_surge: "成交量放大",
  near_limit_up: "逼近涨停",
  rapid_rise: "快速拉升",
  rapid_drop: "快速跳水",
  sector_move: "板块异动",
}

export const ALERT_TYPE_COLORS: Record<AlertType, string> = {
  price_surge: "red",
  price_drop: "green",
  volume_surge: "orange",
  near_limit_up: "magenta",
  rapid_rise: "volcano",
  rapid_drop: "cyan",
  sector_move: "purple",
}

// ==================== Fetch Batch Quotes ====================

async function fetchBatchQuotes(
  codes: string[]
): Promise<StockSnapshot[]> {
  if (codes.length === 0) return []

  const secids = codes.map((c) => getSecId(c)).join(",")

  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f2,f3,f4,f5,f6,f7,f8,f10,f12,f14,f15,f16,f17,f18&secids=${secids}&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

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
    volume: Number(item.f5),
    turnoverRate: Number(item.f8),
    volumeRatio: Number(item.f10),
    amount: Number(item.f6),
    high: Number(item.f15),
    low: Number(item.f16),
    open: Number(item.f17),
    prevClose: Number(item.f18),
  }))
}

// ==================== Fetch Market Movers ====================

async function fetchMarketMovers(
  direction: "up" | "down",
  threshold: number,
  count: number = 30
): Promise<StockSnapshot[]> {
  const absThreshold = Math.abs(threshold)
  const po = direction === "up" ? 1 : 0
  const filter = direction === "up"
    ? `f3>=${absThreshold}`
    : `f3<=-${absThreshold}`

  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${count}&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f5,f6,f8,f10,f12,f14,f15,f16,f17,f18&fid=f3&po=${po}&fltt=2&fl=${filter}&ut=fa5fd1943c7b386f172d6893dbfba10b`

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
    volume: Number(item.f5),
    turnoverRate: Number(item.f8),
    volumeRatio: Number(item.f10),
    amount: Number(item.f6),
    high: Number(item.f15),
    low: Number(item.f16),
    open: Number(item.f17),
    prevClose: Number(item.f18),
  }))
}

// ==================== Fetch HK Market Movers ====================

async function fetchHKMarketMovers(
  direction: "up" | "down",
  threshold: number,
  count: number = 20
): Promise<StockSnapshot[]> {
  const absThreshold = Math.abs(threshold)
  const po = direction === "up" ? 1 : 0
  const filter = direction === "up"
    ? `f3>=${absThreshold}`
    : `f3<=-${absThreshold}`

  // 港股主板: m:116+t:1, 港股创业板: m:116+t:2
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${count}&fs=m:116+t:1,m:116+t:2&fields=f2,f3,f5,f6,f8,f10,f12,f14,f15,f16,f17,f18&fid=f3&po=${po}&fltt=2&fl=${filter}&ut=fa5fd1943c7b386f172d6893dbfba10b`

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
    volume: Number(item.f5),
    turnoverRate: Number(item.f8),
    volumeRatio: Number(item.f10),
    amount: Number(item.f6),
    high: Number(item.f15),
    low: Number(item.f16),
    open: Number(item.f17),
    prevClose: Number(item.f18),
  }))
}

// ==================== Fetch Sector Movers ====================

interface SectorSnapshot {
  code: string
  name: string
  changePercent: number
  leadingStock: string
  leadingStockChange: number
}

async function fetchSectorMovers(
  threshold: number
): Promise<SectorSnapshot[]> {
  const results: SectorSnapshot[] = []

  for (const type of ["m:90+t:2", "m:90+t:3"] as const) {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=50&fs=${type}&fields=f3,f12,f14,f128,f136,f140&fid=f3&po=1&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) continue

    const items = normalizeDiff(result.data.diff)
      .filter((item) => Math.abs(Number(item.f3)) >= threshold)
      .map((item) => ({
        code: String(item.f12),
        name: String(item.f14),
        changePercent: Number(item.f3),
        leadingStock: String(item.f140 || ""),
        leadingStockChange: Number(item.f136),
      }))

    results.push(...items)
  }

  return results
}

// ==================== Core Scanner ====================

export async function scanAlerts(
  rules: AlertRuleConfig[],
  watchlistCodes: string[]
): Promise<ScanResult[]> {
  const enabledRules = rules.filter((r) => r.enabled)
  if (enabledRules.length === 0) return []

  const results: ScanResult[] = []

  // Group rules by scope to minimize API calls
  const watchlistRules = enabledRules.filter((r) => r.scope === "watchlist")
  const marketRules = enabledRules.filter((r) => r.scope === "market")
  const customRules = enabledRules.filter((r) => r.scope === "custom")

  // Fetch watchlist quotes if needed
  const needsWatchlist = watchlistRules.length > 0 && watchlistCodes.length > 0
  const watchlistQuotes = needsWatchlist
    ? await fetchBatchQuotes(watchlistCodes)
    : []

  // Fetch custom stock quotes
  const customCodes = customRules.flatMap((r) => r.stockCodes || [])
  const uniqueCustomCodes = [...new Set(customCodes)]
  const customQuotes = uniqueCustomCodes.length > 0
    ? await fetchBatchQuotes(uniqueCustomCodes)
    : []

  // Process watchlist rules
  for (const rule of watchlistRules) {
    const alerts = checkRule(rule, watchlistQuotes)
    results.push(...alerts)
  }

  // Process custom rules
  for (const rule of customRules) {
    const ruleCodes = new Set(rule.stockCodes || [])
    const ruleQuotes = customQuotes.filter((q) => ruleCodes.has(q.code))
    const alerts = checkRule(rule, ruleQuotes)
    results.push(...alerts)
  }

  // Process market-wide rules
  for (const rule of marketRules) {
    const alerts = await checkMarketRule(rule)
    results.push(...alerts)
  }

  return results
}

function checkRule(
  rule: AlertRuleConfig,
  quotes: StockSnapshot[]
): ScanResult[] {
  const results: ScanResult[] = []

  for (const quote of quotes) {
    const result = evaluateRule(rule, quote)
    if (result) {
      results.push(result)
    }
  }

  return results
}

function evaluateRule(
  rule: AlertRuleConfig,
  quote: StockSnapshot
): ScanResult | null {
  switch (rule.type) {
    case "price_surge":
      return checkPriceSurge(rule, quote)
    case "price_drop":
      return checkPriceDrop(rule, quote)
    case "volume_surge":
      return checkVolumeSurge(rule, quote)
    case "near_limit_up":
      return checkNearLimitUp(rule, quote)
    case "rapid_rise":
      return checkRapidRise(rule, quote)
    case "rapid_drop":
      return checkRapidDrop(rule, quote)
    default:
      return null
  }
}

// ==================== Rule Checks ====================

function checkPriceSurge(
  rule: AlertRuleConfig,
  quote: StockSnapshot
): ScanResult | null {
  if (quote.changePercent >= rule.threshold) {
    return {
      type: "price_surge",
      stockCode: quote.code,
      stockName: quote.name,
      message: `${quote.name}(${quote.code}) 涨幅达 ${quote.changePercent.toFixed(2)}%，突破 ${rule.threshold}% 阈值`,
      detail: {
        price: quote.price,
        changePercent: quote.changePercent,
        volume: quote.volume,
        amount: quote.amount,
      },
      currentValue: quote.changePercent,
      threshold: rule.threshold,
      ruleId: rule.id,
    }
  }
  return null
}

function checkPriceDrop(
  rule: AlertRuleConfig,
  quote: StockSnapshot
): ScanResult | null {
  const absThreshold = Math.abs(rule.threshold)
  if (quote.changePercent <= -absThreshold) {
    return {
      type: "price_drop",
      stockCode: quote.code,
      stockName: quote.name,
      message: `${quote.name}(${quote.code}) 跌幅达 ${quote.changePercent.toFixed(2)}%，突破 -${absThreshold}% 阈值`,
      detail: {
        price: quote.price,
        changePercent: quote.changePercent,
        volume: quote.volume,
        amount: quote.amount,
      },
      currentValue: quote.changePercent,
      threshold: rule.threshold,
      ruleId: rule.id,
    }
  }
  return null
}

function checkVolumeSurge(
  rule: AlertRuleConfig,
  quote: StockSnapshot
): ScanResult | null {
  // 量比 = 当前成交量 / 近5日同时段平均成交量，>threshold 视为放量
  if (quote.volumeRatio >= rule.threshold) {
    return {
      type: "volume_surge",
      stockCode: quote.code,
      stockName: quote.name,
      message: `${quote.name}(${quote.code}) 量比 ${quote.volumeRatio.toFixed(2)}，超过 ${rule.threshold} 倍阈值`,
      detail: {
        price: quote.price,
        changePercent: quote.changePercent,
        volumeRatio: quote.volumeRatio,
        turnoverRate: quote.turnoverRate,
        volume: quote.volume,
        amount: quote.amount,
      },
      currentValue: quote.volumeRatio,
      threshold: rule.threshold,
      ruleId: rule.id,
    }
  }
  return null
}

function checkNearLimitUp(
  rule: AlertRuleConfig,
  quote: StockSnapshot
): ScanResult | null {
  // 港股无涨跌停限制，跳过
  if (isHKCode(quote.code)) return null
  // 已涨停的不再算"逼近"
  if (isLimitUp(quote.code, quote.changePercent, quote.name)) return null
  // 板块感知：rule.threshold 解释为"距涨停的百分点"，默认 2 表示距涨停 ≤2%
  // 兼容旧规则：若 threshold > 5（旧的绝对涨幅写法），降级为 distance=2
  const distance = rule.threshold > 5 ? 2 : rule.threshold
  const limit = getLimitUpPercent(quote.code, quote.name)
  const distToLimit = distanceToLimitUp(quote.code, quote.changePercent, quote.name)
  if (distToLimit <= distance && quote.changePercent > 0) {
    return {
      type: "near_limit_up",
      stockCode: quote.code,
      stockName: quote.name,
      message: `${quote.name}(${quote.code}) 涨幅 ${quote.changePercent.toFixed(2)}%，距涨停${distToLimit.toFixed(2)}%（涨停幅度${limit}%）`,
      detail: {
        price: quote.price,
        changePercent: quote.changePercent,
        distanceToLimit: distToLimit,
        limitPercent: limit,
        turnoverRate: quote.turnoverRate,
      },
      currentValue: quote.changePercent,
      threshold: rule.threshold,
      ruleId: rule.id,
    }
  }
  return null
}

function checkRapidRise(
  rule: AlertRuleConfig,
  quote: StockSnapshot
): ScanResult | null {
  // 日内振幅检测：(high - open) / open * 100 > threshold
  if (quote.open <= 0) return null
  const riseFromOpen = ((quote.price - quote.open) / quote.open) * 100
  if (riseFromOpen >= rule.threshold && quote.changePercent > 0) {
    return {
      type: "rapid_rise",
      stockCode: quote.code,
      stockName: quote.name,
      message: `${quote.name}(${quote.code}) 日内拉升 ${riseFromOpen.toFixed(2)}%，快速拉升`,
      detail: {
        price: quote.price,
        open: quote.open,
        riseFromOpen,
        changePercent: quote.changePercent,
        turnoverRate: quote.turnoverRate,
      },
      currentValue: riseFromOpen,
      threshold: rule.threshold,
      ruleId: rule.id,
    }
  }
  return null
}

function checkRapidDrop(
  rule: AlertRuleConfig,
  quote: StockSnapshot
): ScanResult | null {
  if (quote.open <= 0) return null
  const dropFromOpen = ((quote.price - quote.open) / quote.open) * 100
  const absThreshold = Math.abs(rule.threshold)
  if (dropFromOpen <= -absThreshold && quote.changePercent < 0) {
    return {
      type: "rapid_drop",
      stockCode: quote.code,
      stockName: quote.name,
      message: `${quote.name}(${quote.code}) 日内跳水 ${dropFromOpen.toFixed(2)}%，快速下跌`,
      detail: {
        price: quote.price,
        open: quote.open,
        dropFromOpen,
        changePercent: quote.changePercent,
        turnoverRate: quote.turnoverRate,
      },
      currentValue: dropFromOpen,
      threshold: rule.threshold,
      ruleId: rule.id,
    }
  }
  return null
}

async function checkMarketRule(
  rule: AlertRuleConfig
): Promise<ScanResult[]> {
  switch (rule.type) {
    case "rapid_rise":
      return checkMarketRapidMovers(rule, "up")
    case "rapid_drop":
      return checkMarketRapidMovers(rule, "down")
    case "sector_move":
      return checkSectorMove(rule)
    default:
      return []
  }
}

async function checkMarketRapidMovers(
  rule: AlertRuleConfig,
  direction: "up" | "down"
): Promise<ScanResult[]> {
  // 同时扫描 A股 和 港股
  const [aMovers, hkMovers] = await Promise.all([
    fetchMarketMovers(direction, rule.threshold, 10),
    fetchHKMarketMovers(direction, rule.threshold, 10),
  ])
  const type = direction === "up" ? "rapid_rise" : "rapid_drop"
  const label = direction === "up" ? "快速拉升" : "快速跳水"

  const toResult = (stock: StockSnapshot, marketTag: string): ScanResult => ({
    type,
    stockCode: stock.code,
    stockName: stock.name,
    message: `[${marketTag}] ${stock.name}(${stock.code}) 涨跌幅 ${stock.changePercent.toFixed(2)}%，${label}`,
    detail: {
      price: stock.price,
      changePercent: stock.changePercent,
      turnoverRate: stock.turnoverRate,
      market: marketTag,
    },
    currentValue: stock.changePercent,
    threshold: rule.threshold,
    ruleId: rule.id,
  })

  return [
    ...aMovers.map((s) => toResult(s, "A股")),
    ...hkMovers.map((s) => toResult(s, "港股")),
  ]
}

async function checkSectorMove(
  rule: AlertRuleConfig
): Promise<ScanResult[]> {
  const sectors = await fetchSectorMovers(rule.threshold)

  return sectors.map((sector) => ({
    type: "sector_move" as AlertType,
    stockCode: sector.code,
    stockName: sector.name,
    message: `板块 ${sector.name} 涨跌幅 ${sector.changePercent.toFixed(2)}%，领涨股 ${sector.leadingStock}(${sector.leadingStockChange.toFixed(2)}%)`,
    detail: {
      changePercent: sector.changePercent,
      leadingStock: sector.leadingStock,
      leadingStockChange: sector.leadingStockChange,
    },
    currentValue: sector.changePercent,
    threshold: rule.threshold,
    ruleId: rule.id,
  }))
}

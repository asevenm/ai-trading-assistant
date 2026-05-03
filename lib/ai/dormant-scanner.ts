import { normalizeDiff } from "../market-api"
import { getStockKline } from "../market-api"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface DormantStock {
  code: string
  name: string
  price: number
  changePercent: number
  /** 30日振幅 (high-low)/mean */
  amplitude30d: number
  /** 近5日均量 / 近20日均量 */
  volumeRatio5to20: number
  /** 收盘距MA20百分比 */
  distanceToMA20: number
  /** 距离60日低点的涨幅% */
  distanceFrom60dLow: number
  /** 近5日主力净流入累计 (元) */
  mainNetInflow5d: number
  /** 主力净流入/流通市值 */
  mainInflowPercent: number
  /** 流通市值 */
  circulationMarketCap: number
  /** 换手率 */
  turnoverRate: number
  /** 量比 */
  volumeRatio: number
  industry: string
  /** 蛰伏分 0-100 */
  dormantScore: number
  /** 评分因子 */
  scoreFactors: string[]
}

export interface DormantScanOptions {
  maxMarketCap?: number // 流通市值上限 (元) 默认 200亿
  maxAmplitude30d?: number // 30日振幅上限 默认 15%
  topN?: number // 返回数量 默认 30
}

interface CandidateRaw {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  volumeRatio: number
  amount: number
  circulationMarketCap: number
  mainNetInflow: number
  mainInflowPercent: number
  industry: string
  change60d: number
}

// ==================== 主入口 ====================

/**
 * 蛰伏股扫描
 *
 * 蛰伏特征：
 * - 30日振幅 < 15% (横盘)
 * - 近5日缩量 (量能 < 近20日均量)
 * - 收盘贴近MA20 (筹码稳定)
 * - 主力近期净流入为正 (悄悄进场)
 * - 流通市值适中 (避免大票)
 */
export async function scanDormantStocks(
  options: DormantScanOptions = {}
): Promise<DormantStock[]> {
  const maxMarketCap = options.maxMarketCap ?? 2e10 // 200亿
  const maxAmp = options.maxAmplitude30d ?? 15
  const topN = options.topN ?? 30

  // Step 1: 列表 API 预筛 → 主力净流入排前面
  const candidates = await fetchCandidates(maxMarketCap)
  if (candidates.length === 0) return []

  // Step 2: 限制深度扫描数量到 100，避免过多 K线请求
  const top = candidates.slice(0, 100)

  // Step 3: 并发抓 K线（每批 10）
  const results: DormantStock[] = []
  const batchSize = 10
  for (let i = 0; i < top.length; i += batchSize) {
    const batch = top.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((c) => analyzeWithKline(c, maxAmp))
    )
    for (const r of batchResults) {
      if (r) results.push(r)
    }
  }

  return results
    .sort((a, b) => b.dormantScore - a.dormantScore)
    .slice(0, topN)
}

// ==================== Step 1: 候选池 ====================

async function fetchCandidates(maxMarketCap: number): Promise<CandidateRaw[]> {
  try {
    // 字段：
    // f2=现价 f3=今日涨幅 f6=成交额 f8=换手 f10=量比
    // f12=代码 f14=名称 f20=流通市值
    // f24=近5日涨跌幅 f25=近10日涨跌幅 f26=近60日涨跌幅
    // f62=主力净流入 f184=主力净占比 f100=行业
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get` +
      `?pn=1&pz=500&po=1&fid=f62` +
      `&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23` +
      `&fields=f2,f3,f6,f8,f10,f12,f14,f20,f24,f25,f26,f62,f184,f100` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()
    if (!result?.data?.diff) return []

    const items = normalizeDiff(result.data.diff).map((item) => ({
      code: String(item.f12),
      name: String(item.f14),
      price: Number(item.f2) || 0,
      changePercent: Number(item.f3) || 0,
      turnoverRate: Number(item.f8) || 0,
      volumeRatio: Number(item.f10) || 0,
      amount: Number(item.f6) || 0,
      circulationMarketCap: Number(item.f20) || 0,
      mainNetInflow: Number(item.f62) || 0,
      mainInflowPercent: Number(item.f184) || 0,
      industry: String(item.f100 || ""),
      change60d: Number(item.f26) || 0,
    }))

    // 客户端过滤：
    // 1) 流通市值上限
    // 2) 今日涨幅 -3 ~ +3 (没大动)
    // 3) 量比 < 1.5 (没放量)
    // 4) 换手 < 5
    // 5) 60日涨跌幅 -25 ~ +25 (近期没大趋势)
    // 6) 主力净流入 > 0
    // 7) 排除 ST
    return items.filter((s) => {
      if (s.circulationMarketCap === 0 || s.circulationMarketCap > maxMarketCap) return false
      if (s.changePercent < -3 || s.changePercent > 3) return false
      if (s.volumeRatio > 1.5) return false
      if (s.turnoverRate > 5) return false
      if (s.change60d < -25 || s.change60d > 25) return false
      if (s.mainNetInflow <= 0) return false
      if (s.name.includes("ST") || s.name.includes("退")) return false
      return true
    })
  } catch (error) {
    console.error("Failed to fetch dormant candidates:", error)
    return []
  }
}

// ==================== Step 2: K线深度分析 ====================

async function analyzeWithKline(
  candidate: CandidateRaw,
  maxAmp: number
): Promise<DormantStock | null> {
  try {
    const klines = await getStockKline(candidate.code, "daily", 60)
    if (klines.length < 30) return null

    const recent30 = klines.slice(-30)
    const recent20 = klines.slice(-20)
    const recent5 = klines.slice(-5)
    const recent60 = klines.slice(-60)

    // 30日振幅
    const high30 = Math.max(...recent30.map((k) => k.high))
    const low30 = Math.min(...recent30.map((k) => k.low))
    const mean30 = recent30.reduce((s, k) => s + k.close, 0) / recent30.length
    const amplitude30d = mean30 > 0 ? ((high30 - low30) / mean30) * 100 : 0

    if (amplitude30d > maxAmp) return null

    // 量能对比
    const avg5Vol = recent5.reduce((s, k) => s + k.volume, 0) / recent5.length
    const avg20Vol = recent20.reduce((s, k) => s + k.volume, 0) / recent20.length
    const volumeRatio5to20 = avg20Vol > 0 ? avg5Vol / avg20Vol : 1

    // MA20 距离
    const ma20 = recent20.reduce((s, k) => s + k.close, 0) / recent20.length
    const distanceToMA20 = ma20 > 0 ? ((candidate.price - ma20) / ma20) * 100 : 0

    // 距60日低点
    const low60 = Math.min(...recent60.map((k) => k.low))
    const distanceFrom60dLow = low60 > 0 ? ((candidate.price - low60) / low60) * 100 : 0

    // 评分
    const { score, factors } = computeDormantScore({
      amplitude30d,
      volumeRatio5to20,
      distanceToMA20,
      distanceFrom60dLow,
      mainInflowPercent: candidate.mainInflowPercent,
      mainNetInflow: candidate.mainNetInflow,
      circulationMarketCap: candidate.circulationMarketCap,
    })

    return {
      code: candidate.code,
      name: candidate.name,
      price: candidate.price,
      changePercent: candidate.changePercent,
      amplitude30d,
      volumeRatio5to20,
      distanceToMA20,
      distanceFrom60dLow,
      mainNetInflow5d: candidate.mainNetInflow, // 注：clist 返回的是当日值，作为近期信号代理
      mainInflowPercent: candidate.mainInflowPercent,
      circulationMarketCap: candidate.circulationMarketCap,
      turnoverRate: candidate.turnoverRate,
      volumeRatio: candidate.volumeRatio,
      industry: candidate.industry,
      dormantScore: score,
      scoreFactors: factors,
    }
  } catch (error) {
    console.error(`Failed to analyze ${candidate.code}:`, error)
    return null
  }
}

// ==================== 评分 ====================

interface DormantScoreInput {
  amplitude30d: number
  volumeRatio5to20: number
  distanceToMA20: number
  distanceFrom60dLow: number
  mainInflowPercent: number
  mainNetInflow: number
  circulationMarketCap: number
}

function computeDormantScore(input: DormantScoreInput): {
  score: number
  factors: string[]
} {
  const factors: string[] = []
  let score = 0

  // 1. 横盘程度 (满 30)
  if (input.amplitude30d < 8) {
    score += 30
    factors.push(`极致横盘(${input.amplitude30d.toFixed(1)}%)`)
  } else if (input.amplitude30d < 12) {
    score += 22
    factors.push(`横盘(${input.amplitude30d.toFixed(1)}%)`)
  } else if (input.amplitude30d < 15) {
    score += 12
    factors.push(`温和震荡`)
  }

  // 2. 缩量 (满 20)
  if (input.volumeRatio5to20 < 0.7) {
    score += 20
    factors.push(`极度缩量(${(input.volumeRatio5to20 * 100).toFixed(0)}%)`)
  } else if (input.volumeRatio5to20 < 0.9) {
    score += 14
    factors.push(`缩量整理`)
  } else if (input.volumeRatio5to20 > 1.3) {
    score -= 5
    factors.push(`已放量`)
  }

  // 3. 贴近MA20 (满 15)
  const ma20Dist = Math.abs(input.distanceToMA20)
  if (ma20Dist < 2) {
    score += 15
    factors.push(`贴近MA20`)
  } else if (ma20Dist < 5) {
    score += 8
  } else if (ma20Dist > 10) {
    score -= 5
  }

  // 4. 低位 (满 15)
  if (input.distanceFrom60dLow < 5) {
    score += 15
    factors.push(`60日地板`)
  } else if (input.distanceFrom60dLow < 10) {
    score += 10
    factors.push(`接近低点`)
  } else if (input.distanceFrom60dLow > 30) {
    score -= 10
    factors.push(`偏离低点`)
  }

  // 5. 主力悄悄进场 (满 20)
  if (input.mainInflowPercent >= 2) {
    score += 20
    factors.push(`主力净占比${input.mainInflowPercent.toFixed(1)}%`)
  } else if (input.mainInflowPercent >= 1) {
    score += 12
    factors.push(`主力流入${input.mainInflowPercent.toFixed(1)}%`)
  } else if (input.mainInflowPercent > 0) {
    score += 5
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors,
  }
}

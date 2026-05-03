import { getStockKline, type KlineItem } from "./market-api"

// ==================== Types ====================

export interface DnaMatchInput {
  targetCode: string
  windowDays: number // 对比窗口（默认30天）
  futureDays: number // 未来观察天数（默认10天）
  candidateCodes: string[] // 候选池
}

export interface DnaMatch {
  code: string
  name: string
  matchStartDate: string
  matchEndDate: string
  similarity: number // 0-1
  futurePerformance: {
    day3: number // 3日后收益率 %
    day5: number
    day10: number
    day20: number
    maxGain: number // 窗口末到20天内最大涨幅
    maxDrawdown: number // 最大回撤
  } | null
}

export interface DnaMatchResult {
  target: {
    code: string
    name: string
    windowStart: string
    windowEnd: string
  }
  matches: DnaMatch[]
  aggregateStats: {
    totalMatches: number
    avgDay3: number
    avgDay5: number
    avgDay10: number
    winRateDay5: number // 5日后为正的比例
    winRateDay10: number
  }
}

// ==================== 相似度算法 ====================

/**
 * 标准化 K 线：以窗口第一日收盘价为基准，计算相对变化率
 * 结果向量每个元素是 [-N%, +N%] 的百分比
 */
function normalizeKline(klines: KlineItem[]): number[] {
  if (klines.length === 0) return []
  const base = klines[0].close
  if (base <= 0) return []
  return klines.map((k) => ((k.close - base) / base) * 100)
}

/**
 * 标准化成交量：每日量/窗口平均量 - 1
 */
function normalizeVolume(klines: KlineItem[]): number[] {
  if (klines.length === 0) return []
  const avg = klines.reduce((s, k) => s + k.volume, 0) / klines.length
  if (avg <= 0) return []
  return klines.map((k) => k.volume / avg - 1)
}

/**
 * 余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  if (denom === 0) return 0
  return dot / denom
}

/**
 * 综合相似度：价格相似性 70% + 量能相似性 30%
 */
function computeSimilarity(targetKlines: KlineItem[], candidateKlines: KlineItem[]): number {
  const priceTarget = normalizeKline(targetKlines)
  const priceCand = normalizeKline(candidateKlines)
  const volTarget = normalizeVolume(targetKlines)
  const volCand = normalizeVolume(candidateKlines)

  const priceSim = cosineSimilarity(priceTarget, priceCand)
  const volSim = cosineSimilarity(volTarget, volCand)

  // 映射到 [0, 1]，负相关视为 0
  const priceNorm = Math.max(0, priceSim)
  const volNorm = Math.max(0, volSim)

  return priceNorm * 0.7 + volNorm * 0.3
}

// ==================== 滑动窗口搜索 ====================

async function findBestMatchInCandidate(
  targetKlines: KlineItem[],
  candidateCode: string,
  windowDays: number,
  futureDays: number
): Promise<DnaMatch | null> {
  const lookback = 250 + futureDays // 约1年 + 未来观察期
  const candidateKlines = await getStockKline(candidateCode, "daily", lookback)

  if (candidateKlines.length < windowDays + futureDays + 1) return null

  // 不和目标股当前窗口比对（同一只股票自己比自己肯定100%相似）
  // 最后 windowDays 可能就是目标股当前状态，所以滑窗截至倒数 futureDays 之前
  const maxStart = candidateKlines.length - windowDays - futureDays
  if (maxStart <= 0) return null

  let bestScore = 0
  let bestStart = -1

  for (let start = 0; start <= maxStart; start++) {
    const window = candidateKlines.slice(start, start + windowDays)
    const sim = computeSimilarity(targetKlines, window)
    if (sim > bestScore) {
      bestScore = sim
      bestStart = start
    }
  }

  if (bestStart < 0 || bestScore < 0.85) return null // 相似度阈值

  const matchEnd = bestStart + windowDays - 1
  const future = computeFuturePerformance(candidateKlines, matchEnd, futureDays)

  return {
    code: candidateCode,
    name: "", // 由调用方填充
    matchStartDate: candidateKlines[bestStart].date,
    matchEndDate: candidateKlines[matchEnd].date,
    similarity: bestScore,
    futurePerformance: future,
  }
}

function computeFuturePerformance(
  klines: KlineItem[],
  matchEndIdx: number,
  futureDays: number
): DnaMatch["futurePerformance"] {
  const endClose = klines[matchEndIdx].close
  if (endClose <= 0) return null
  if (matchEndIdx + futureDays >= klines.length) return null

  const futureWindow = klines.slice(matchEndIdx + 1, matchEndIdx + 1 + 20)
  if (futureWindow.length < 3) return null

  const getReturn = (daysAfter: number): number => {
    if (daysAfter > futureWindow.length) return 0
    return ((futureWindow[daysAfter - 1].close - endClose) / endClose) * 100
  }

  let maxHigh = endClose
  let maxDrawdown = 0
  for (const k of futureWindow) {
    maxHigh = Math.max(maxHigh, k.high)
    const drawdown = ((k.low - maxHigh) / maxHigh) * 100
    maxDrawdown = Math.min(maxDrawdown, drawdown)
  }
  const maxGain = ((maxHigh - endClose) / endClose) * 100

  return {
    day3: getReturn(3),
    day5: getReturn(5),
    day10: getReturn(10),
    day20: getReturn(20),
    maxGain,
    maxDrawdown,
  }
}

// ==================== 聚合结果 ====================

export async function findDnaMatches(
  input: DnaMatchInput,
  nameMap: Map<string, string> = new Map()
): Promise<DnaMatchResult> {
  const targetKlines = await getStockKline(input.targetCode, "daily", input.windowDays + 5)
  const windowKlines = targetKlines.slice(-input.windowDays)

  if (windowKlines.length < input.windowDays) {
    return emptyResult(input.targetCode, nameMap.get(input.targetCode) ?? "")
  }

  // 并发搜索所有候选
  const matchPromises = input.candidateCodes
    .filter((c) => c !== input.targetCode)
    .map((code) =>
      findBestMatchInCandidate(windowKlines, code, input.windowDays, input.futureDays)
    )

  const results = await Promise.all(matchPromises)
  const validMatches = results
    .filter((m): m is DnaMatch => m !== null)
    .map((m) => ({ ...m, name: nameMap.get(m.code) ?? m.code }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20)

  const stats = computeAggregateStats(validMatches)

  return {
    target: {
      code: input.targetCode,
      name: nameMap.get(input.targetCode) ?? "",
      windowStart: windowKlines[0].date,
      windowEnd: windowKlines[windowKlines.length - 1].date,
    },
    matches: validMatches,
    aggregateStats: stats,
  }
}

function emptyResult(code: string, name: string): DnaMatchResult {
  return {
    target: { code, name, windowStart: "", windowEnd: "" },
    matches: [],
    aggregateStats: {
      totalMatches: 0,
      avgDay3: 0,
      avgDay5: 0,
      avgDay10: 0,
      winRateDay5: 0,
      winRateDay10: 0,
    },
  }
}

function computeAggregateStats(matches: DnaMatch[]): DnaMatchResult["aggregateStats"] {
  const validMatches = matches.filter((m) => m.futurePerformance !== null)
  if (validMatches.length === 0) {
    return {
      totalMatches: 0,
      avgDay3: 0,
      avgDay5: 0,
      avgDay10: 0,
      winRateDay5: 0,
      winRateDay10: 0,
    }
  }

  const sumDay3 = validMatches.reduce((s, m) => s + (m.futurePerformance?.day3 ?? 0), 0)
  const sumDay5 = validMatches.reduce((s, m) => s + (m.futurePerformance?.day5 ?? 0), 0)
  const sumDay10 = validMatches.reduce((s, m) => s + (m.futurePerformance?.day10 ?? 0), 0)
  const winDay5 = validMatches.filter((m) => (m.futurePerformance?.day5 ?? 0) > 0).length
  const winDay10 = validMatches.filter((m) => (m.futurePerformance?.day10 ?? 0) > 0).length

  return {
    totalMatches: validMatches.length,
    avgDay3: sumDay3 / validMatches.length,
    avgDay5: sumDay5 / validMatches.length,
    avgDay10: sumDay10 / validMatches.length,
    winRateDay5: (winDay5 / validMatches.length) * 100,
    winRateDay10: (winDay10 / validMatches.length) * 100,
  }
}

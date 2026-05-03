import { getLimitUpPool, type LimitUpPoolStock } from "../theme-radar-api"
import { computePromotionProbability, type PromotionScore } from "./promotion-probability"

// ==================== Types ====================

export interface BacktestSample {
  date: string
  nextDate: string
  code: string
  name: string
  consecutiveBoards: number
  predictedProbability: number
  predictedLevel: PromotionScore["level"]
  /** 实际是否进阶 */
  promoted: boolean
  /** 进阶后连板数 */
  nextDayBoards: number | null
}

export interface BucketStats {
  /** 等级 */
  level: PromotionScore["level"]
  /** 概率区间下限 */
  lowerBound: number
  /** 概率区间上限 */
  upperBound: number
  /** 该区间样本数 */
  count: number
  /** 模型平均预测概率 */
  avgPredicted: number
  /** 实际命中率 */
  actualHitRate: number
  /** 校准误差 = |avgPredicted - actualHitRate| */
  calibrationError: number
}

export interface BoardLevelStats {
  /** 当时的连板数 */
  boards: number
  /** 总样本数 */
  count: number
  /** 实际进阶次数 */
  promotedCount: number
  /** 实际进阶率 */
  hitRate: number
  /** 模型平均预测 */
  avgPredicted: number
}

export interface BacktestReport {
  /** 起止日期 */
  fromDate: string
  toDate: string
  /** 实际有效交易日数（pool 非空） */
  tradingDays: number
  /** 总样本数 */
  totalSamples: number
  /** 整体命中率 */
  overallHitRate: number
  /** 等级分桶 */
  buckets: BucketStats[]
  /** 按当时连板数分桶 */
  byBoardLevel: BoardLevelStats[]
  /** 模型综合校准误差（加权平均） */
  weightedCalibrationError: number
  /** 全部样本（前端可展开看明细） */
  samples: BacktestSample[]
}

// ==================== 主入口 ====================

/**
 * 进阶概率历史回测
 *
 * 流程：
 * 1. 倒推近 N 个工作日（自动跳过空池天）
 * 2. 每天：拉涨停池，给每只股打分
 * 3. 与第二天涨停池对比：是否进阶（连板数 +1）
 * 4. 按等级分桶统计实际命中率
 *
 * 注意：流通市值用当前值作为历史代理（短期股本变化可忽略）
 *       板块强度因历史板块流向数据未取，设为中性 0
 */
export async function runPromotionBacktest(
  daysBack: number = 20,
  maxSamplesPerDay: number = 100
): Promise<BacktestReport> {
  const today = new Date()
  // 拉取覆盖周末的天数 (×1.5)
  const calendarDays = Math.ceil(daysBack * 1.5) + 2

  // 收集 N 个交易日的 (date, pool) - 倒序
  const dailyPools: { date: string; pool: LimitUpPoolStock[] }[] = []
  for (let i = 1; i <= calendarDays && dailyPools.length < daysBack + 1; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = formatDate(d)
    const pool = await getLimitUpPool(dateStr)
    if (pool.length > 0) {
      dailyPools.push({ date: dateStr, pool })
    }
  }

  // dailyPools[0] 是最新交易日，dailyPools[1] 是上一交易日 ...
  // 配对 (sampleDay, nextDay) = (dailyPools[i+1], dailyPools[i])
  // 即 sampleDay 在前面（更早），nextDay 在后面（更晚）

  const samples: BacktestSample[] = []

  for (let i = 1; i < dailyPools.length; i++) {
    const sampleDay = dailyPools[i]
    const nextDay = dailyPools[i - 1]
    const nextPoolMap = new Map(nextDay.pool.map((s) => [s.code, s]))

    // 同梯队抱团数（按当日 pool）
    const peerCountByBoards = new Map<number, number>()
    for (const s of sampleDay.pool) {
      peerCountByBoards.set(
        s.consecutiveBoards,
        (peerCountByBoards.get(s.consecutiveBoards) ?? 0) + 1
      )
    }

    const stocksToScore = sampleDay.pool.slice(0, maxSamplesPerDay)
    for (const stock of stocksToScore) {
      const score = computePromotionProbability({
        stock,
        circulationMarketCap: 0, // 历史流通市值未拉取，封单ratio项不参与
        peerCount: peerCountByBoards.get(stock.consecutiveBoards) ?? 1,
        themeStrength: 0, // 历史板块流向未拉，板块强度项不参与
        themeChangePercent: 0,
      })

      const next = nextPoolMap.get(stock.code)
      const promoted = !!next && next.consecutiveBoards === stock.consecutiveBoards + 1

      samples.push({
        date: sampleDay.date,
        nextDate: nextDay.date,
        code: stock.code,
        name: stock.name,
        consecutiveBoards: stock.consecutiveBoards,
        predictedProbability: score.probability,
        predictedLevel: score.level,
        promoted,
        nextDayBoards: next?.consecutiveBoards ?? null,
      })
    }
  }

  // ==================== 统计聚合 ====================

  const buckets = aggregateBuckets(samples)
  const byBoardLevel = aggregateByBoardLevel(samples)

  const totalSamples = samples.length
  const totalPromoted = samples.filter((s) => s.promoted).length
  const overallHitRate = totalSamples > 0 ? (totalPromoted / totalSamples) * 100 : 0

  // 加权校准误差：每个 bucket 误差 × 样本数 / 总样本
  let weightedErr = 0
  for (const b of buckets) {
    if (b.count === 0) continue
    weightedErr += b.calibrationError * (b.count / totalSamples)
  }

  return {
    fromDate: dailyPools[dailyPools.length - 1]?.date ?? "",
    toDate: dailyPools[1]?.date ?? "",
    tradingDays: Math.max(0, dailyPools.length - 1),
    totalSamples,
    overallHitRate,
    buckets,
    byBoardLevel,
    weightedCalibrationError: weightedErr,
    samples,
  }
}

// ==================== Helpers ====================

function aggregateBuckets(samples: BacktestSample[]): BucketStats[] {
  const def: { level: PromotionScore["level"]; lower: number; upper: number }[] = [
    { level: "low", lower: 0, upper: 35 },
    { level: "medium", lower: 35, upper: 55 },
    { level: "high", lower: 55, upper: 75 },
    { level: "veryHigh", lower: 75, upper: 100 },
  ]

  return def.map(({ level, lower, upper }) => {
    const inBucket = samples.filter(
      (s) => s.predictedProbability >= lower && s.predictedProbability < (upper === 100 ? 101 : upper)
    )
    const count = inBucket.length
    const promoted = inBucket.filter((s) => s.promoted).length
    const avgPred = count > 0
      ? inBucket.reduce((sum, s) => sum + s.predictedProbability, 0) / count
      : 0
    const actual = count > 0 ? (promoted / count) * 100 : 0
    return {
      level,
      lowerBound: lower,
      upperBound: upper,
      count,
      avgPredicted: avgPred,
      actualHitRate: actual,
      calibrationError: Math.abs(avgPred - actual),
    }
  })
}

function aggregateByBoardLevel(samples: BacktestSample[]): BoardLevelStats[] {
  const map = new Map<number, BacktestSample[]>()
  for (const s of samples) {
    const list = map.get(s.consecutiveBoards) ?? []
    map.set(s.consecutiveBoards, [...list, s])
  }
  const result: BoardLevelStats[] = []
  for (const [boards, list] of map.entries()) {
    const count = list.length
    const promoted = list.filter((s) => s.promoted).length
    const avgPred = list.reduce((sum, s) => sum + s.predictedProbability, 0) / count
    result.push({
      boards,
      count,
      promotedCount: promoted,
      hitRate: (promoted / count) * 100,
      avgPredicted: avgPred,
    })
  }
  return result.sort((a, b) => a.boards - b.boards)
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

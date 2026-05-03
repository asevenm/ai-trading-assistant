/**
 * 6 维归一化 - 把每个原始指标映射到 0-100 分
 *
 * 归一化策略：
 * - 涨幅 / 主力净流入 / 换手率：用百分位排名（在当前候选池中的排名）
 * - 涨停密度：limitUpCount × scaleFactor，封顶 100
 * - 龙头高度：topStreak 阶梯映射（1板=20, 2板=40, 3板=60, 4板=80, 5板+=100, +二板辅助分）
 * - 消息热度：相对热度（条数 ×缩放）
 */

import type { BoardRawMetrics } from "../types"

/**
 * 百分位归一化：返回每个 board 在数组里的百分位排名（0-100）
 * 大于 0 的值才参与排名；其余补 0
 */
export function percentileRank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }))
  // 只对 > 0 的值排名（流出 / 跌幅记 0 分）
  const positive = indexed.filter((x) => x.v > 0).sort((a, b) => a.v - b.v)
  const total = positive.length
  const rankMap = new Map<number, number>()

  positive.forEach((item, idx) => {
    const score = total > 1 ? (idx / (total - 1)) * 100 : 100
    rankMap.set(item.i, score)
  })

  return values.map((_, i) => rankMap.get(i) ?? 0)
}

/**
 * 双向百分位归一化：负值取 |v| 的反向百分位（用于资金流：流入正贡献，流出负贡献）
 *
 * 流入 Top → 100；流出 Top → -100；中间线性
 * 但因为最终汇总会再做加权（负分会拖低总分），这里把范围压缩到 0-100：
 *   流入 Top → 100；流出 Top → 0；零附近 → 50
 */
export function bidirectionalRank(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const min = sorted[0] ?? 0
  const max = sorted[sorted.length - 1] ?? 0

  // 全 0 或单值
  if (max === min) return values.map(() => 50)

  return values.map((v) => {
    if (v >= 0) {
      // 正区间：50 → 100 线性映射
      return max > 0 ? 50 + (v / max) * 50 : 50
    } else {
      // 负区间：50 → 0 线性映射
      return min < 0 ? 50 - (Math.abs(v) / Math.abs(min)) * 50 : 50
    }
  })
}

/**
 * 涨停密度评分：每只涨停股 +X 分，封顶 100
 *
 * 经验值：板块 5 个涨停 = 50 分，10 个 = 100 分
 */
export function scoreLimitUpDensity(count: number): number {
  return Math.min(count * 10, 100)
}

/**
 * 龙头高度评分：阶梯式 + 二板辅助分
 *
 * 1板=20, 2板=40, 3板=60, 4板=80, 5板+=100
 */
export function scoreStreak(topStreak: number): number {
  if (topStreak <= 0) return 0
  if (topStreak >= 5) return 100
  return topStreak * 20
}

/**
 * 消息热度评分：每条相关新闻 +X 分，封顶 100
 *
 * 经验值：3 条 = 30 分，10 条 = 100 分
 */
export function scoreNewsHeat(newsCount: number): number {
  return Math.min(newsCount * 10, 100)
}

/**
 * 对一组 boards 的原始指标做归一化，返回 6 维子分数
 */
export interface NormalizedScores {
  changePctScores: number[]
  limitUpScores: number[]
  mainInflowScores: number[]
  streakScores: number[]
  turnoverScores: number[]
  newsScores: number[]
}

export function normalizeBoards(boards: BoardRawMetrics[]): NormalizedScores {
  return {
    changePctScores: percentileRank(boards.map((b) => b.changePct)),
    limitUpScores: boards.map((b) => scoreLimitUpDensity(b.limitUpCount)),
    mainInflowScores: bidirectionalRank(boards.map((b) => b.mainNetInflow)),
    streakScores: boards.map((b) => scoreStreak(b.topStreak)),
    turnoverScores: percentileRank(boards.map((b) => b.turnoverRate)),
    newsScores: boards.map((b) => scoreNewsHeat(b.newsHeat)),
  }
}

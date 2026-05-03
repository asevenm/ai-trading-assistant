/**
 * 复合打分 - 把 6 维子分数加权求和，得到 0-100 强度分
 */

import { SCORE_WEIGHTS, type BoardRawMetrics, type BoardScore } from "../types"
import { normalizeBoards } from "./normalize"

/**
 * 给一组板块打分
 *
 * 输入是一个数组（必须一起传，因为归一化是相对的——百分位排名依赖整个候选池）
 * 输出是与输入等长的评分数组
 */
export function scoreBoards(boards: BoardRawMetrics[]): BoardScore[] {
  const norm = normalizeBoards(boards)

  return boards.map((_, i) => {
    const components = {
      changePctScore: norm.changePctScores[i] ?? 0,
      limitUpScore: norm.limitUpScores[i] ?? 0,
      mainInflowScore: norm.mainInflowScores[i] ?? 0,
      streakScore: norm.streakScores[i] ?? 0,
      turnoverScore: norm.turnoverScores[i] ?? 0,
      newsScore: norm.newsScores[i] ?? 0,
    }

    const strengthScore = round1(
      components.changePctScore * SCORE_WEIGHTS.changePct +
        components.limitUpScore * SCORE_WEIGHTS.limitUp +
        components.mainInflowScore * SCORE_WEIGHTS.mainInflow +
        components.streakScore * SCORE_WEIGHTS.streak +
        components.turnoverScore * SCORE_WEIGHTS.turnover +
        components.newsScore * SCORE_WEIGHTS.news
    )

    return { strengthScore, components }
  })
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * 板块原始指标装配 - 把 board quote / limit-ups / turnover / news 合并成 BoardRawMetrics
 *
 * 这是采集层最终入口：调用一次拿到所有板块的 6 维原始数据，供评分引擎使用
 */

import type { BoardRawMetrics, BoardType } from "../types"
import { fetchCandidateBoards, type BoardQuote } from "./boards"
import { aggregateLimitUpsByBoard, type BoardLimitUpAggregate } from "./limit-ups"
import { fetchBoardTurnoverStats } from "./members"

export interface AssembleOptions {
  /** 是否拉取板块成分股计算换手率（默认 true，关闭可加速） */
  withTurnover?: boolean
  /** 候选池大小（每个 boardType 取多少个） */
  topN?: number
}

export interface AssembledData {
  industry: BoardRawMetrics[]
  concept: BoardRawMetrics[]
  /** 龙头炸板检测（用于硬规则）：boardType:boardId → leaderBusted */
  leaderBustedMap: Map<string, boolean>
}

/**
 * 装配所有板块的 6 维原始指标
 */
export async function assembleBoardMetrics(
  options: AssembleOptions = {}
): Promise<AssembledData> {
  const { withTurnover = true, topN = 50 } = options

  // 并行拉取：行业候选 + 概念候选 + 涨停池聚合
  const [industryQuotes, conceptQuotes, limitUpAgg] = await Promise.all([
    fetchCandidateBoards("INDUSTRY", topN),
    fetchCandidateBoards("CONCEPT", topN),
    aggregateLimitUpsByBoard(),
  ])

  // 拉换手率（可选，避免 API 风暴）
  let industryTurnover = new Map<string, number>()
  let conceptTurnover = new Map<string, number>()
  if (withTurnover) {
    const [iStats, cStats] = await Promise.all([
      fetchBoardTurnoverStats(industryQuotes.map((b) => b.boardId)),
      fetchBoardTurnoverStats(conceptQuotes.map((b) => b.boardId)),
    ])
    industryTurnover = new Map(
      Array.from(iStats.entries()).map(([k, v]) => [k, v.avgTurnoverRate])
    )
    conceptTurnover = new Map(
      Array.from(cStats.entries()).map(([k, v]) => [k, v.avgTurnoverRate])
    )
  }

  const leaderBustedMap = new Map<string, boolean>()

  const industry = industryQuotes.map((q) =>
    buildMetrics(q, limitUpAgg.industryMap, industryTurnover, leaderBustedMap)
  )
  const concept = conceptQuotes.map((q) =>
    buildMetrics(q, limitUpAgg.conceptMap, conceptTurnover, leaderBustedMap)
  )

  return { industry, concept, leaderBustedMap }
}

function buildMetrics(
  quote: BoardQuote,
  limitUpMap: Map<string, BoardLimitUpAggregate>,
  turnoverMap: Map<string, number>,
  leaderBustedMap: Map<string, boolean>
): BoardRawMetrics {
  // 涨停池按板块"名称"聚合，板块行情按"代码"，需要按名称匹配
  const limitUpAgg = limitUpMap.get(quote.boardName)

  const limitUpCount = limitUpAgg?.limitUpCount ?? 0
  const topStreak = limitUpAgg?.topStreak ?? 0
  const leaderStocks = limitUpAgg?.leaderStocks ?? []

  // 记录龙头炸板状态用于硬规则
  if (limitUpAgg?.leaderBusted) {
    leaderBustedMap.set(`${quote.boardType}:${quote.boardId}`, true)
  }

  return {
    boardType: quote.boardType,
    boardId: quote.boardId,
    boardName: quote.boardName,
    changePct: quote.changePct,
    limitUpCount,
    mainNetInflow: quote.mainNetInflow,
    topStreak,
    turnoverRate: turnoverMap.get(quote.boardId) ?? 0,
    newsHeat: 0, // TODO: 接入 news-intel 在 Step 3 完成
    leaderStocks,
  }
}

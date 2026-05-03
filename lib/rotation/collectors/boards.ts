/**
 * 板块行情 + 资金流采集器
 *
 * 合并 sector-flow-api 的资金流数据 与 sector-api 的板块详情，
 * 输出每个板块的"基础四维"：涨幅、主力净流入、turnover (用于推导换手率)、领涨股
 */

import { getSectorFlow, getSectorFlowOutflow, type SectorFlow } from "../../sector-flow-api"
import { normalizeDiff } from "../../market-api"
import type { BoardType } from "../types"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

export interface BoardQuote {
  boardId: string
  boardName: string
  boardType: BoardType
  changePct: number
  mainNetInflow: number
  turnover: number // 板块成交额（用于估算换手率）
  leadingStockCode: string // 领涨股代码
  leadingStockName: string
  leadingStockChangePct: number
  // 板块平均换手率 - 通过 board ranking 接口扩展字段拿不到，
  // 采用 turnover / 板内流通市值 估算，初版仅占位
  avgTurnoverRate: number
}

/**
 * 拉取一个类型的所有候选板块（涨幅 Top + 资金流 Top + 跌幅 Top 合并去重）
 *
 * 候选池策略：取 Top N 强势 + Top N 弱势（用于检测退潮）+ Top N 资金流
 */
export async function fetchCandidateBoards(
  boardType: BoardType,
  topN: number = 50
): Promise<BoardQuote[]> {
  const fsType = boardType === "INDUSTRY" ? "industry" : "concept"

  const [topGain, topLoss, topInflow, topOutflow] = await Promise.all([
    fetchBoardRankingByChange(boardType, topN, true),
    fetchBoardRankingByChange(boardType, Math.floor(topN / 2), false),
    getSectorFlow(fsType, topN),
    getSectorFlowOutflow(fsType, Math.floor(topN / 2)),
  ])

  // 用 boardId 合并去重
  const merged = new Map<string, BoardQuote>()

  for (const item of topGain) {
    merged.set(item.boardId, item)
  }
  for (const item of topLoss) {
    if (!merged.has(item.boardId)) merged.set(item.boardId, item)
  }

  // 资金流数据补齐 mainNetInflow（topGain/topLoss 的 ranking API 可能没有）
  const flowMap = new Map<string, SectorFlow>()
  for (const f of [...topInflow, ...topOutflow]) {
    flowMap.set(f.code, f)
  }

  for (const [id, board] of merged.entries()) {
    const flow = flowMap.get(id)
    if (flow && (!board.mainNetInflow || board.mainNetInflow === 0)) {
      merged.set(id, { ...board, mainNetInflow: flow.mainNetInflow })
    }
  }

  // 把流入榜里但不在涨跌榜里的板块也加进来
  for (const flow of [...topInflow, ...topOutflow]) {
    if (!merged.has(flow.code)) {
      merged.set(flow.code, {
        boardId: flow.code,
        boardName: flow.name,
        boardType,
        changePct: flow.changePercent,
        mainNetInflow: flow.mainNetInflow,
        turnover: 0,
        leadingStockCode: "",
        leadingStockName: "",
        leadingStockChangePct: 0,
        avgTurnoverRate: 0,
      })
    }
  }

  return Array.from(merged.values())
}

/**
 * 板块涨跌幅排行（含领涨股 + 成交额）
 *
 * 用 clist API 直接拉，比 getSectorRanking 多取 turnover 和 leading stock
 * 字段说明：f3=涨幅 f6=成交额 f12=代码 f14=名称 f128=领涨股名 f136=领涨股涨幅 f140=领涨股代码 f62=主力净流入
 */
async function fetchBoardRankingByChange(
  boardType: BoardType,
  count: number,
  ascending: boolean
): Promise<BoardQuote[]> {
  const fs = boardType === "INDUSTRY" ? "m:90+t:2" : "m:90+t:3"
  const po = ascending ? 1 : 0
  const url =
    `https://push2.eastmoney.com/api/qt/clist/get` +
    `?pn=1&pz=${count}&po=${po}&fid=f3&fs=${fs}` +
    `&fields=f2,f3,f6,f12,f14,f62,f128,f136,f140` +
    `&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b`

  try {
    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    return normalizeDiff(result.data.diff).map((item) => ({
      boardId: String(item.f12),
      boardName: String(item.f14),
      boardType,
      changePct: Number(item.f3) || 0,
      mainNetInflow: Number(item.f62) || 0,
      turnover: Number(item.f6) || 0,
      leadingStockCode: String(item.f140 || ""),
      leadingStockName: String(item.f128 || ""),
      leadingStockChangePct: Number(item.f136) || 0,
      avgTurnoverRate: 0,
    }))
  } catch (error) {
    console.error(`Failed to fetch board ranking (${boardType}, ascending=${ascending}):`, error)
    return []
  }
}

/**
 * 单板块详情（包含成分股聚合数据用于换手率估算）
 * 仅在需要精细数据时调用，调用成本较高
 */
export async function fetchBoardDetail(
  boardId: string,
  boardType: BoardType
): Promise<BoardQuote | null> {
  const list = await fetchCandidateBoards(boardType, 200)
  return list.find((b) => b.boardId === boardId) ?? null
}

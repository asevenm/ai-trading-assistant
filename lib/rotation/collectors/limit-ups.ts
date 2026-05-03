/**
 * 涨停池映射到板块
 *
 * 利用 theme-radar-api 已实现的 getLimitUpPool（含 consecutiveBoards/bustCount/industry/concepts）
 * 把涨停股聚合到 行业 / 概念 板块，输出每个板块的：
 * - 涨停数 (limitUpCount)
 * - 最高连板数 (topStreak)
 * - 龙头股代码列表 (leaderStocks)
 * - 龙头炸板检测 (leaderBusted)
 */

import { getLimitUpPool, type LimitUpPoolStock } from "../../theme-radar-api"
import type { BoardType } from "../types"

export interface BoardLimitUpAggregate {
  /** 板块名称（用于匹配 board ranking 的 boardName） */
  boardName: string
  boardType: BoardType
  limitUpCount: number
  topStreak: number
  /** 龙头股（最高连板，最多 3 只） */
  leaderStocks: string[]
  /** 龙头是否炸板（任一龙头股 bustCount > 0 → true） */
  leaderBusted: boolean
  /** 板内所有涨停股代码 */
  memberCodes: string[]
}

/**
 * 拉取当日涨停池并聚合到板块
 *
 * @param date YYYYMMDD 格式（不传则取当日）
 */
export async function aggregateLimitUpsByBoard(
  date?: string
): Promise<{
  industryMap: Map<string, BoardLimitUpAggregate>
  conceptMap: Map<string, BoardLimitUpAggregate>
  pool: LimitUpPoolStock[]
}> {
  const pool = await getLimitUpPool(date)

  const industryMap = new Map<string, BoardLimitUpAggregate>()
  const conceptMap = new Map<string, BoardLimitUpAggregate>()

  for (const stock of pool) {
    if (stock.industry) {
      addToMap(industryMap, stock.industry, "INDUSTRY", stock)
    }
    for (const concept of stock.concepts) {
      addToMap(conceptMap, concept, "CONCEPT", stock)
    }
  }

  // 计算 leaderBusted: 取每个 board 的最高连板股，看 bustCount
  for (const map of [industryMap, conceptMap]) {
    for (const [, agg] of map) {
      finalizeLeader(agg, pool)
    }
  }

  return { industryMap, conceptMap, pool }
}

function addToMap(
  map: Map<string, BoardLimitUpAggregate>,
  boardName: string,
  boardType: BoardType,
  stock: LimitUpPoolStock
): void {
  const trimmed = boardName.trim()
  if (!trimmed || trimmed === "-") return

  const existing = map.get(trimmed)
  if (!existing) {
    map.set(trimmed, {
      boardName: trimmed,
      boardType,
      limitUpCount: 1,
      topStreak: stock.consecutiveBoards,
      leaderStocks: [stock.code],
      leaderBusted: false,
      memberCodes: [stock.code],
    })
    return
  }

  const newStreak = Math.max(existing.topStreak, stock.consecutiveBoards)
  const newMembers = [...existing.memberCodes, stock.code]

  // 龙头列表 = 该板块内连板数等于 topStreak 的股票（在最后 finalize 时重算）
  map.set(trimmed, {
    ...existing,
    limitUpCount: existing.limitUpCount + 1,
    topStreak: newStreak,
    memberCodes: newMembers,
  })
}

/**
 * 重新计算龙头股 + 炸板检测
 * 龙头 = 板块内连板数等于 topStreak 的股，最多 3 只（按封单金额排序）
 */
function finalizeLeader(
  agg: BoardLimitUpAggregate,
  pool: LimitUpPoolStock[]
): void {
  const codeSet = new Set(agg.memberCodes)
  const members = pool.filter((s) => codeSet.has(s.code))
  const leaders = members
    .filter((s) => s.consecutiveBoards === agg.topStreak)
    .sort((a, b) => b.sealAmount - a.sealAmount)
    .slice(0, 3)

  agg.leaderStocks = leaders.map((s) => s.code)
  agg.leaderBusted = leaders.some((s) => s.bustCount > 0)
}

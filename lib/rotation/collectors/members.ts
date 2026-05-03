/**
 * 板块成分股采集 - 计算平均换手率
 *
 * 仅对"重点关注板块"调用（top N），避免对 300+ 概念全量调用导致 API 风暴
 */

import { getSectorMembers } from "../../sector-api"

export interface BoardTurnoverStats {
  boardId: string
  avgTurnoverRate: number
  memberCount: number
}

/**
 * 批量获取板块平均换手率
 *
 * @param boardIds 板块代码列表（建议 ≤ 50 个）
 * @param sampleSize 每个板块取前 N 只成分股的换手率均值（默认 50，防止全量拉太多）
 */
export async function fetchBoardTurnoverStats(
  boardIds: string[],
  sampleSize: number = 50
): Promise<Map<string, BoardTurnoverStats>> {
  const result = new Map<string, BoardTurnoverStats>()

  // 并发拉取（限制并发数避免被限流）
  const CONCURRENCY = 8
  const chunks = chunkArray(boardIds, CONCURRENCY)

  for (const chunk of chunks) {
    const stats = await Promise.all(
      chunk.map(async (boardId) => {
        try {
          const members = await getSectorMembers(boardId, sampleSize)
          if (members.length === 0) {
            return { boardId, avgTurnoverRate: 0, memberCount: 0 }
          }
          const sum = members.reduce((s, m) => s + (m.turnoverRate || 0), 0)
          return {
            boardId,
            avgTurnoverRate: sum / members.length,
            memberCount: members.length,
          }
        } catch {
          return { boardId, avgTurnoverRate: 0, memberCount: 0 }
        }
      })
    )

    for (const s of stats) {
      result.set(s.boardId, s)
    }
  }

  return result
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

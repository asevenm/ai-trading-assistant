import { prisma } from "./prisma"
import { findDnaMatches, type DnaMatchInput, type DnaMatchResult } from "./dna-similarity"
import { getStockRanking } from "./market-api"

/**
 * DNA 匹配：组合候选池，调用相似度搜索
 *
 * 候选池来源：
 * 1. 用户自选股（user's watchlist）
 * 2. 最近活跃股（近期涨幅靠前的 top N）
 */
export async function runDnaMatch(params: {
  userId: string
  targetCode: string
  windowDays?: number
  futureDays?: number
  extraCandidates?: string[]
}): Promise<DnaMatchResult> {
  const windowDays = params.windowDays ?? 30
  const futureDays = params.futureDays ?? 10

  // 1. 自选股
  const watchlist = await prisma.stock.findMany({
    where: { userId: params.userId },
    select: { code: true, name: true },
  })

  // 2. 近期活跃股（按涨幅Top 50）
  const topGainers = await getStockRanking("f3", 50, false)

  // 合并去重
  const nameMap = new Map<string, string>()
  for (const s of watchlist) nameMap.set(s.code, s.name)
  for (const s of topGainers) nameMap.set(s.code, s.name)

  const candidateSet = new Set<string>([
    ...watchlist.map((s) => s.code),
    ...topGainers.map((s) => s.code),
    ...(params.extraCandidates ?? []),
  ])
  candidateSet.delete(params.targetCode)

  const input: DnaMatchInput = {
    targetCode: params.targetCode,
    windowDays,
    futureDays,
    candidateCodes: Array.from(candidateSet),
  }

  return findDnaMatches(input, nameMap)
}

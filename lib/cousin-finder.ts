import { normalizeDiff } from "./market-api"
import { getLimitUpPool } from "./theme-radar-api"
import { getSectorFlow } from "./sector-flow-api"
import { isLimitUp } from "./limit-rules"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface CousinStock {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  volumeRatio: number
  amount: number
  circulationMarketCap: number
  mainNetInflow: number
  industry: string
  /** 与源票共享的概念/板块名 */
  sharedThemes: string[]
  /** 综合兄弟分 0-100 */
  cousinScore: number
  /** 评分因子说明 */
  scoreFactors: string[]
}

export interface CousinReport {
  source: {
    code: string
    name: string
    industry: string
    concepts: string[]
    isLimitUp: boolean
  }
  themes: { name: string; code: string }[]
  cousins: CousinStock[]
}

interface SourceStockInfo {
  code: string
  name: string
  industry: string
  concepts: string[]
  circulationMarketCap: number
  isLimitUp: boolean
  changePercent: number
}

// ==================== Public API ====================

/**
 * 查找一只股票的"兄弟股" - 同概念/同板块但今日尚未启动的潜力补涨票
 *
 * 核心逻辑：
 * 1. 获取源票的概念/行业列表
 * 2. 找出共享概念的板块成分股
 * 3. 过滤：今日未涨停 + 涨幅 < 5% + 流通盘 ±100% 内
 * 4. 评分：今日强度 + 量比 + 资金流入 + 共享概念数
 */
export async function findCousinStocks(
  sourceCode: string,
  options: { limit?: number; maxChangePercent?: number } = {}
): Promise<CousinReport | null> {
  const limit = options.limit ?? 20
  const maxChangePercent = options.maxChangePercent ?? 5

  const source = await resolveSourceStock(sourceCode)
  if (!source) return null

  // 概念名 -> BK代码 映射（从 sector-flow API 取大全集）
  const themeMap = await getThemeNameToCodeMap()

  // 用源票的 [行业, 概念...] 找匹配的 BK 板块
  const sourceThemes = [source.industry, ...source.concepts].filter(Boolean)
  const matchedThemes = sourceThemes
    .map((name) => ({ name, code: themeMap.get(name) ?? null }))
    .filter((t): t is { name: string; code: string } => t.code !== null)

  if (matchedThemes.length === 0) {
    return {
      source: {
        code: source.code,
        name: source.name,
        industry: source.industry,
        concepts: source.concepts,
        isLimitUp: source.isLimitUp,
      },
      themes: [],
      cousins: [],
    }
  }

  // 并发抓取每个板块的成员
  const memberLists = await Promise.all(
    matchedThemes.map((t) =>
      getSectorMembersWithFlow(t.code).then((members) => ({
        themeName: t.name,
        members,
      }))
    )
  )

  // 合并：以 code 为 key，统计每只股共享了多少个源概念
  const candidateMap = new Map<
    string,
    { stock: SectorMemberWithFlow; sharedThemes: string[] }
  >()
  for (const list of memberLists) {
    for (const m of list.members) {
      if (m.code === source.code) continue
      const existing = candidateMap.get(m.code)
      if (existing) {
        if (!existing.sharedThemes.includes(list.themeName)) {
          existing.sharedThemes = [...existing.sharedThemes, list.themeName]
        }
      } else {
        candidateMap.set(m.code, {
          stock: m,
          sharedThemes: [list.themeName],
        })
      }
    }
  }

  const sourceCap = source.circulationMarketCap
  const cousins: CousinStock[] = []

  for (const { stock, sharedThemes } of candidateMap.values()) {
    // 已涨停 → 排除（已启动不算潜力补涨）
    if (isLimitUp(stock.code, stock.changePercent, stock.name)) continue
    // 涨幅过大 → 已启动
    if (stock.changePercent > maxChangePercent) continue
    // 跌幅过深 → 不是补涨候选
    if (stock.changePercent < -3) continue
    // 流通盘差异过大 → 跳过（兄弟股市值应接近）
    if (sourceCap > 0 && stock.circulationMarketCap > 0) {
      const ratio = stock.circulationMarketCap / sourceCap
      if (ratio > 3 || ratio < 0.25) continue
    }

    const { score, factors } = scoreCousin({
      changePercent: stock.changePercent,
      volumeRatio: stock.volumeRatio,
      turnoverRate: stock.turnoverRate,
      mainNetInflow: stock.mainNetInflow,
      sharedThemeCount: sharedThemes.length,
      circulationMarketCap: stock.circulationMarketCap,
    })

    cousins.push({
      code: stock.code,
      name: stock.name,
      price: stock.price,
      changePercent: stock.changePercent,
      turnoverRate: stock.turnoverRate,
      volumeRatio: stock.volumeRatio,
      amount: stock.amount,
      circulationMarketCap: stock.circulationMarketCap,
      mainNetInflow: stock.mainNetInflow,
      industry: stock.industry,
      sharedThemes,
      cousinScore: score,
      scoreFactors: factors,
    })
  }

  cousins.sort((a, b) => b.cousinScore - a.cousinScore)

  return {
    source: {
      code: source.code,
      name: source.name,
      industry: source.industry,
      concepts: source.concepts,
      isLimitUp: source.isLimitUp,
    },
    themes: matchedThemes,
    cousins: cousins.slice(0, limit),
  }
}

// ==================== Source resolution ====================

async function resolveSourceStock(code: string): Promise<SourceStockInfo | null> {
  // 优先从涨停池取（携带完整概念列表）
  const pool = await getLimitUpPool()
  const inPool = pool.find((s) => s.code === code)
  if (inPool) {
    const cap = await getCirculationCap(code)
    return {
      code: inPool.code,
      name: inPool.name,
      industry: inPool.industry,
      concepts: inPool.concepts,
      circulationMarketCap: cap,
      isLimitUp: true,
      changePercent: inPool.changePercent,
    }
  }

  // 非涨停股：取行业 + 流通市值（概念暂不获取，匹配范围会缩小）
  return resolveNonLimitUpStock(code)
}

async function resolveNonLimitUpStock(code: string): Promise<SourceStockInfo | null> {
  try {
    const market = code.startsWith("6") ? "1" : "0"
    const secid = `${market}.${code}`
    // f100 = 行业, f20 = 流通市值, f3 = 涨幅
    const url =
      `https://push2.eastmoney.com/api/qt/stock/get` +
      `?secid=${secid}&fields=f57,f58,f43,f60,f100,f20,f170` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2&invt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()
    if (result.rc !== 0 || !result.data) return null

    const d = result.data
    return {
      code: String(d.f57 || code),
      name: String(d.f58 || ""),
      industry: String(d.f100 || ""),
      concepts: [],
      circulationMarketCap: Number(d.f20) || 0,
      isLimitUp: false,
      changePercent: Number(d.f170) || 0,
    }
  } catch (error) {
    console.error("Failed to resolve source stock:", error)
    return null
  }
}

async function getCirculationCap(code: string): Promise<number> {
  try {
    const market = code.startsWith("6") ? "1" : "0"
    const secid = `${market}.${code}`
    const url =
      `https://push2.eastmoney.com/api/qt/stock/get` +
      `?secid=${secid}&fields=f20` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2&invt=2`
    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()
    return Number(result?.data?.f20) || 0
  } catch {
    return 0
  }
}

// ==================== Theme name → BK code map ====================

let themeMapCache: { map: Map<string, string>; expiresAt: number } | null = null

async function getThemeNameToCodeMap(): Promise<Map<string, string>> {
  if (themeMapCache && themeMapCache.expiresAt > Date.now()) {
    return themeMapCache.map
  }

  // 同时取行业板块 + 概念板块，建立 name → code 映射
  const [industries, concepts] = await Promise.all([
    getSectorFlow("industry", 200),
    getSectorFlow("concept", 500),
  ])
  const map = new Map<string, string>()
  for (const s of industries) map.set(s.name, s.code)
  for (const s of concepts) map.set(s.name, s.code)

  themeMapCache = { map, expiresAt: Date.now() + 10 * 60 * 1000 }
  return map
}

// ==================== Sector members with capital flow ====================

interface SectorMemberWithFlow {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  volumeRatio: number
  amount: number
  circulationMarketCap: number
  mainNetInflow: number
  industry: string
}

/**
 * 取板块成员（含涨幅/换手/量比/流通市值/主力净流入/行业）
 * f10=量比 f20=流通市值 f62=主力净流入 f100=行业
 */
async function getSectorMembersWithFlow(
  bkCode: string
): Promise<SectorMemberWithFlow[]> {
  try {
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get` +
      `?pn=1&pz=200&po=1&fid=f3` +
      `&fs=b:${bkCode}` +
      `&fields=f2,f3,f5,f6,f8,f10,f12,f14,f20,f62,f100` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()
    if (!result?.data?.diff) return []

    return normalizeDiff(result.data.diff).map((item) => ({
      code: String(item.f12),
      name: String(item.f14),
      price: Number(item.f2) || 0,
      changePercent: Number(item.f3) || 0,
      volumeRatio: Number(item.f10) || 0,
      amount: Number(item.f6) || 0,
      turnoverRate: Number(item.f8) || 0,
      circulationMarketCap: Number(item.f20) || 0,
      mainNetInflow: Number(item.f62) || 0,
      industry: String(item.f100 || ""),
    }))
  } catch (error) {
    console.error(`Failed to fetch sector members for ${bkCode}:`, error)
    return []
  }
}

// ==================== Scoring ====================

interface ScoreInput {
  changePercent: number
  volumeRatio: number
  turnoverRate: number
  mainNetInflow: number
  sharedThemeCount: number
  circulationMarketCap: number
}

/**
 * 兄弟分 0-100 加权打分
 *
 * 维度：
 * - 今日涨幅 0-3% 是甜区（已启动但未透支）  权重 25
 * - 量比 > 1.5 资金已苏醒                  权重 20
 * - 主力净流入为正且占比可观                权重 25
 * - 共享概念数（>=2 强联动）                权重 15
 * - 换手率适中(2-15%)                       权重 15
 */
function scoreCousin(input: ScoreInput): { score: number; factors: string[] } {
  const factors: string[] = []
  let score = 0

  // 今日涨幅
  if (input.changePercent >= 1 && input.changePercent <= 4) {
    score += 25
    factors.push(`已苏醒(${input.changePercent.toFixed(1)}%)`)
  } else if (input.changePercent >= 0 && input.changePercent < 1) {
    score += 18
    factors.push("微红盘")
  } else if (input.changePercent >= -2 && input.changePercent < 0) {
    score += 12
    factors.push("低位待启")
  } else if (input.changePercent > 4) {
    score += 8
    factors.push("已启动")
  }

  // 量比
  if (input.volumeRatio >= 2) {
    score += 20
    factors.push(`量比${input.volumeRatio.toFixed(1)}`)
  } else if (input.volumeRatio >= 1.5) {
    score += 14
    factors.push(`量比${input.volumeRatio.toFixed(1)}`)
  } else if (input.volumeRatio >= 1) {
    score += 7
  }

  // 主力净流入
  const inflowYi = input.mainNetInflow / 1e8
  if (input.circulationMarketCap > 0) {
    const inflowPct = (input.mainNetInflow / input.circulationMarketCap) * 100
    if (inflowPct >= 1.5) {
      score += 25
      factors.push(`主力净占比${inflowPct.toFixed(1)}%`)
    } else if (inflowPct >= 0.5) {
      score += 16
      factors.push(`主力净流入${inflowYi.toFixed(2)}亿`)
    } else if (inflowPct > 0) {
      score += 8
    } else if (inflowPct < -1) {
      score -= 5
      factors.push(`主力流出${Math.abs(inflowYi).toFixed(2)}亿`)
    }
  }

  // 共享概念数
  if (input.sharedThemeCount >= 3) {
    score += 15
    factors.push(`${input.sharedThemeCount}重共振`)
  } else if (input.sharedThemeCount === 2) {
    score += 10
    factors.push("双重共振")
  } else {
    score += 4
  }

  // 换手率
  if (input.turnoverRate >= 2 && input.turnoverRate <= 15) {
    score += 15
    factors.push(`换手${input.turnoverRate.toFixed(1)}%`)
  } else if (input.turnoverRate < 1) {
    score -= 5
    factors.push("换手过低")
  } else if (input.turnoverRate > 25) {
    score -= 5
    factors.push("筹码松动")
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
  }
}

// ==================== 页面级聚合：扫整个涨停池的兄弟股 ====================

export interface AggregatedCousinParent {
  /** 拉动这只兄弟股的涨停龙头代码 */
  code: string
  name: string
  /** 龙头连板数 */
  consecutiveBoards: number
  /** 共享的板块/概念名 */
  sharedThemes: string[]
}

export interface AggregatedCousinStock {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  volumeRatio: number
  amount: number
  circulationMarketCap: number
  mainNetInflow: number
  industry: string
  /** 拉动这只票的涨停龙头列表 */
  parents: AggregatedCousinParent[]
  /** 单股基础兄弟分 0-100 */
  baseScore: number
  /** 龙头加权后的聚合分（可>100，方便排序） */
  aggregatedScore: number
  /** 评分因子 */
  scoreFactors: string[]
}

export interface AggregatedCousinReport {
  totalLimitUp: number
  /** 实际参与匹配的板块数 */
  themeCount: number
  /** 候选股总数（过滤前） */
  candidateCount: number
  cousins: AggregatedCousinStock[]
}

/**
 * 页面级兄弟股雷达 - 一键扫描所有涨停龙头的兄弟股
 *
 * 算法：
 * 1. 拉涨停池 + 板块映射
 * 2. 收集所有涉及的 BK 板块（去重）
 * 3. 每个板块只拉一次成员
 * 4. 对每只非涨停成员收集"拉动它的龙头列表"
 * 5. baseScore = 单股兄弟分；aggregatedScore = baseScore × (1 + 龙头加权)
 *
 * 龙头加权 = sum(parent.consecutiveBoards × sqrt(sharedThemeCount))
 */
export async function findAggregatedCousins(
  options: { limit?: number; maxChangePercent?: number; minLimitUpBoards?: number } = {}
): Promise<AggregatedCousinReport> {
  const limit = options.limit ?? 50
  const maxChangePercent = options.maxChangePercent ?? 5
  const minBoards = options.minLimitUpBoards ?? 1

  const pool = await getLimitUpPool()
  const filteredPool = pool.filter((s) => s.consecutiveBoards >= minBoards)

  if (filteredPool.length === 0) {
    return { totalLimitUp: 0, themeCount: 0, candidateCount: 0, cousins: [] }
  }

  const themeMap = await getThemeNameToCodeMap()

  // Step 1: 收集所有 BK 代码 → 哪些龙头通过这个板块拉动
  // bkCode -> { themeName, parents: [poolStock...] }
  const themeToParents = new Map<
    string,
    { themeName: string; parents: typeof filteredPool }
  >()

  for (const parent of filteredPool) {
    const tags = [parent.industry, ...parent.concepts].filter(Boolean)
    for (const tag of tags) {
      const bkCode = themeMap.get(tag)
      if (!bkCode) continue
      const existing = themeToParents.get(bkCode)
      if (existing) {
        existing.parents = [...existing.parents, parent]
      } else {
        themeToParents.set(bkCode, { themeName: tag, parents: [parent] })
      }
    }
  }

  if (themeToParents.size === 0) {
    return {
      totalLimitUp: filteredPool.length,
      themeCount: 0,
      candidateCount: 0,
      cousins: [],
    }
  }

  // Step 2: 每个 BK 只抓一次成员（限制并发避免过载）
  const bkCodes = Array.from(themeToParents.keys())
  const memberMap = new Map<string, SectorMemberWithFlow[]>()
  const batchSize = 8
  for (let i = 0; i < bkCodes.length; i += batchSize) {
    const batch = bkCodes.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map((bk) => getSectorMembersWithFlow(bk).then((m) => [bk, m] as const))
    )
    for (const [bk, m] of results) memberMap.set(bk, m)
  }

  // Step 3: 收集每只非涨停股 → 拉动它的龙头集合
  // 用 Map 累积避免重复，key 为 candidate code
  interface CandidateAccumulator {
    stock: SectorMemberWithFlow
    /** parent code -> { parent, sharedThemes } */
    parentMap: Map<
      string,
      { parent: (typeof filteredPool)[number]; sharedThemes: Set<string> }
    >
  }

  const candidateMap = new Map<string, CandidateAccumulator>()
  const limitUpCodes = new Set(filteredPool.map((s) => s.code))

  for (const [bkCode, info] of themeToParents.entries()) {
    const members = memberMap.get(bkCode) ?? []
    for (const member of members) {
      // 排除涨停龙头本身
      if (limitUpCodes.has(member.code)) continue
      // 排除已涨停股
      if (isLimitUp(member.code, member.changePercent, member.name)) continue

      let acc = candidateMap.get(member.code)
      if (!acc) {
        acc = { stock: member, parentMap: new Map() }
        candidateMap.set(member.code, acc)
      }

      for (const parent of info.parents) {
        let parentEntry = acc.parentMap.get(parent.code)
        if (!parentEntry) {
          parentEntry = { parent, sharedThemes: new Set() }
          acc.parentMap.set(parent.code, parentEntry)
        }
        parentEntry.sharedThemes.add(info.themeName)
      }
    }
  }

  const candidateCount = candidateMap.size

  // Step 4: 评分 + 过滤
  const cousins: AggregatedCousinStock[] = []
  for (const acc of candidateMap.values()) {
    const m = acc.stock

    // 涨幅过滤
    if (m.changePercent > maxChangePercent) continue
    if (m.changePercent < -3) continue
    // 跳过 ST/退
    if (m.name.includes("ST") || m.name.includes("退")) continue

    const parents: AggregatedCousinParent[] = Array.from(acc.parentMap.values()).map(
      (p) => ({
        code: p.parent.code,
        name: p.parent.name,
        consecutiveBoards: p.parent.consecutiveBoards,
        sharedThemes: Array.from(p.sharedThemes),
      })
    )

    // 总共享的板块数
    const totalShared = new Set<string>()
    for (const p of parents) for (const t of p.sharedThemes) totalShared.add(t)

    const { score: baseScore, factors } = scoreCousin({
      changePercent: m.changePercent,
      volumeRatio: m.volumeRatio,
      turnoverRate: m.turnoverRate,
      mainNetInflow: m.mainNetInflow,
      sharedThemeCount: totalShared.size,
      circulationMarketCap: m.circulationMarketCap,
    })

    // 龙头加权
    let parentBoost = 0
    for (const p of parents) {
      parentBoost += p.consecutiveBoards * Math.sqrt(p.sharedThemes.length)
    }
    // boost 系数 0~1.5
    const boostFactor = Math.min(1.5, parentBoost / 8)
    const aggregatedScore = baseScore * (1 + boostFactor)

    cousins.push({
      code: m.code,
      name: m.name,
      price: m.price,
      changePercent: m.changePercent,
      turnoverRate: m.turnoverRate,
      volumeRatio: m.volumeRatio,
      amount: m.amount,
      circulationMarketCap: m.circulationMarketCap,
      mainNetInflow: m.mainNetInflow,
      industry: m.industry,
      parents: parents.sort((a, b) => b.consecutiveBoards - a.consecutiveBoards),
      baseScore,
      aggregatedScore: Math.round(aggregatedScore * 10) / 10,
      scoreFactors: factors,
    })
  }

  cousins.sort((a, b) => b.aggregatedScore - a.aggregatedScore)

  return {
    totalLimitUp: filteredPool.length,
    themeCount: themeToParents.size,
    candidateCount,
    cousins: cousins.slice(0, limit),
  }
}

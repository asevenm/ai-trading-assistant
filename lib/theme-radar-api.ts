import { getSectorFlow, type SectorFlow } from "./sector-flow-api"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

/** 涨停池个股（含连板数/封单/概念） */
export interface LimitUpPoolStock {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  volumeRatio: number
  amount: number
  bustCount: number // 开板次数（0 = 一字板/未炸）
  consecutiveBoards: number // 连板天数
  limitUpCount: number // 近期累计涨停次数
  sealAmount: number // 封单金额（元）
  firstSealTime: string // HHMMSS
  lastSealTime: string
  industry: string
  concepts: string[]
}

/** 主题分层 */
export interface ThemeTiers {
  leader: LimitUpPoolStock[] // 龙头（最高连板、封单王）
  highLevel: LimitUpPoolStock[] // 高度板（连板≥2，非龙头）
  follower: LimitUpPoolStock[] // 跟风（首板）
  peripheral: LimitUpPoolStock[] // 蹭概念（非涨停，留给 peripheral 扫描）
}

export type ThemeStage = "initial" | "expanding" | "peak" | "fading"

/** 主题聚合 */
export interface ThemeCluster {
  name: string
  sectorCode: string | null
  sectorChangePercent: number | null
  mainNetInflow: number | null
  limitUpCount: number
  maxConsecutive: number
  totalSealAmount: number
  totalAmount: number
  bustCount: number
  bustRate: number
  strength: number // 0-100
  stage: ThemeStage
  tiers: ThemeTiers
}

/** 题材雷达总览 */
export interface ThemeRadarSnapshot {
  date: string
  totalLimitUp: number
  totalBusted: number
  themes: ThemeCluster[]
  uncategorized: LimitUpPoolStock[]
}

// ==================== 涨停池 API ====================

interface RawZTStock {
  c: string
  n: string
  p: number
  zdp: number
  hs: number
  lb: number
  amount: number
  zbc: number
  fund: number
  fbt: number
  lbt: number
  hybk: string
  zttj: { days: number; ct: number; first?: string }
}

/**
 * 获取当日涨停池（东方财富 push2ex 接口）
 * - 返回每只涨停股的连板数、封单金额、首封时间、行业、概念
 */
export async function getLimitUpPool(date?: string): Promise<LimitUpPoolStock[]> {
  try {
    const d = date ?? formatDate(new Date())
    const url =
      `https://push2ex.eastmoney.com/getTopicZTPool` +
      `?ut=7eea3edcaed734bea9cbfc24409ed989` +
      `&dpt=wz.ztzt&Pageindex=0&pagesize=200` +
      `&sort=fbt:asc&date=${d}` +
      `&_=${Date.now()}`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()
    const pool: RawZTStock[] | undefined = result?.data?.pool

    if (!pool || !Array.isArray(pool)) return []

    return pool.map((s) => {
      // hybk 可能是 "CPO;光模块" 或 "半导体,芯片" 这种多标签
      const industryRaw = String(s.hybk || "")
      const tags = splitTags(industryRaw)
      const primaryIndustry = tags[0] ?? ""
      const concepts = tags.slice(1)

      return {
        code: String(s.c),
        name: String(s.n),
        price: Number(s.p) / 1000,
        changePercent: Number(s.zdp) / 100,
        turnoverRate: Number(s.hs) / 100,
        volumeRatio: Number(s.lb) / 100,
        amount: Number(s.amount),
        bustCount: Number(s.zbc) || 0,
        consecutiveBoards: Number(s.zttj?.days) || 1,
        limitUpCount: Number(s.zttj?.ct) || 1,
        sealAmount: Number(s.fund),
        firstSealTime: formatHMS(s.fbt),
        lastSealTime: formatHMS(s.lbt),
        industry: primaryIndustry,
        concepts,
      }
    })
  } catch (error) {
    console.error("Failed to fetch limit-up pool:", error)
    return []
  }
}

function splitTags(raw: string): string[] {
  if (!raw) return []
  return raw
    .split(/[,，;；|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "-")
}

// ==================== 主题聚类 ====================

/**
 * 将涨停池按概念聚类，匹配板块资金流数据
 * 过滤：只保留至少2只涨停股的概念（过滤单票噪音）
 */
export function clusterByTheme(
  pool: LimitUpPoolStock[],
  conceptFlow: SectorFlow[]
): ThemeCluster[] {
  // 建立 概念名 -> 板块数据 映射
  const flowMap = new Map<string, SectorFlow>()
  for (const f of conceptFlow) flowMap.set(f.name, f)

  // 按概念聚合涨停股
  const grouped = new Map<string, LimitUpPoolStock[]>()
  for (const stock of pool) {
    const tags = stock.concepts.length > 0 ? stock.concepts : [stock.industry]
    for (const tag of tags) {
      if (!tag) continue
      const list = grouped.get(tag) ?? []
      grouped.set(tag, [...list, stock])
    }
  }

  // 只保留至少2个成员的主题
  const clusters: ThemeCluster[] = []
  for (const [name, members] of grouped.entries()) {
    if (members.length < 2) continue

    const flow = flowMap.get(name) ?? null
    const cluster = buildCluster(name, members, flow)
    clusters.push(cluster)
  }

  return clusters.sort((a, b) => b.strength - a.strength)
}

function buildCluster(
  name: string,
  members: LimitUpPoolStock[],
  flow: SectorFlow | null
): ThemeCluster {
  const maxConsec = members.reduce((m, s) => Math.max(m, s.consecutiveBoards), 1)
  const totalSeal = members.reduce((m, s) => m + s.sealAmount, 0)
  const totalAmount = members.reduce((m, s) => m + s.amount, 0)
  const bustCount = members.filter((s) => s.bustCount > 0).length
  const bustRate = members.length > 0 ? (bustCount / members.length) * 100 : 0

  const tiers = classifyTiers(members)
  const stage = inferStage(members.length, maxConsec, bustRate, flow?.mainNetInflow ?? 0)
  const strength = computeStrength({
    count: members.length,
    maxConsec,
    totalSeal,
    bustRate,
    mainInflow: flow?.mainNetInflow ?? 0,
  })

  return {
    name,
    sectorCode: flow?.code ?? null,
    sectorChangePercent: flow?.changePercent ?? null,
    mainNetInflow: flow?.mainNetInflow ?? null,
    limitUpCount: members.length,
    maxConsecutive: maxConsec,
    totalSealAmount: totalSeal,
    totalAmount,
    bustCount,
    bustRate,
    strength,
    stage,
    tiers,
  }
}

/**
 * 分层：龙头/高度/跟风/蹭概念
 * - 龙头：最高连板数且封单金额最大的（最多2只）
 * - 高度：连板≥2且非龙头
 * - 跟风：首板
 * - 蹭概念：留空（后续由 peripheral scan 填充）
 */
function classifyTiers(members: LimitUpPoolStock[]): ThemeTiers {
  const sorted = [...members].sort((a, b) => {
    if (b.consecutiveBoards !== a.consecutiveBoards) {
      return b.consecutiveBoards - a.consecutiveBoards
    }
    return b.sealAmount - a.sealAmount
  })

  const maxBoard = sorted[0]?.consecutiveBoards ?? 1
  const leader = sorted.filter((s) => s.consecutiveBoards === maxBoard).slice(0, 2)
  const leaderCodes = new Set(leader.map((s) => s.code))

  const highLevel = sorted.filter(
    (s) => s.consecutiveBoards >= 2 && !leaderCodes.has(s.code)
  )
  const follower = sorted.filter((s) => s.consecutiveBoards === 1)

  return {
    leader,
    highLevel,
    follower,
    peripheral: [],
  }
}

/**
 * 推断主题阶段
 * - initial: 刚起风（涨停数<3 或 最高连板≤2）
 * - expanding: 扩散中（涨停数≥3, 最高连板≥2, 炸板率<30%）
 * - peak: 高潮（最高连板≥4 或 有大量高度板）
 * - fading: 退潮（炸板率>40% 或 主力净流出）
 */
function inferStage(
  count: number,
  maxConsec: number,
  bustRate: number,
  mainInflow: number
): ThemeStage {
  if (bustRate > 40 || (mainInflow < 0 && Math.abs(mainInflow) > 5e8)) return "fading"
  if (maxConsec >= 4) return "peak"
  if (count >= 3 && maxConsec >= 2 && bustRate < 30) return "expanding"
  return "initial"
}

/**
 * 综合热度评分 0-100
 * 权重：涨停数30 + 最高连板25 + 封单20 + 主力流入25 - 炸板15
 */
function computeStrength(input: {
  count: number
  maxConsec: number
  totalSeal: number
  bustRate: number
  mainInflow: number
}): number {
  const countScore = Math.min(input.count * 5, 30)
  const consecScore = Math.min(input.maxConsec * 5, 25)
  const sealScore = Math.min((input.totalSeal / 1e9) * 10, 20)
  const inflowScore = input.mainInflow > 0
    ? Math.min((input.mainInflow / 1e9) * 10, 25)
    : Math.max((input.mainInflow / 1e9) * 5, -25)
  const bustPenalty = Math.min((input.bustRate / 100) * 15, 15)

  const raw = countScore + consecScore + sealScore + inflowScore - bustPenalty
  return Math.max(0, Math.min(100, Math.round(raw)))
}

// ==================== 汇总 ====================

export async function getThemeRadarSnapshot(date?: string): Promise<ThemeRadarSnapshot> {
  const [pool, conceptFlow] = await Promise.all([
    getLimitUpPool(date),
    getSectorFlow("concept", 100),
  ])

  const themes = clusterByTheme(pool, conceptFlow)

  // 未归入任何主题的涨停股（概念都<2只成员）
  const classified = new Set<string>()
  for (const t of themes) {
    for (const s of [...t.tiers.leader, ...t.tiers.highLevel, ...t.tiers.follower]) {
      classified.add(s.code)
    }
  }
  const uncategorized = pool.filter((s) => !classified.has(s.code))

  return {
    date: date ?? formatDate(new Date()),
    totalLimitUp: pool.length,
    totalBusted: pool.filter((s) => s.bustCount > 0).length,
    themes,
    uncategorized,
  }
}

// ==================== Utils ====================

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

function formatHMS(n: number | string | undefined): string {
  if (!n) return ""
  const s = String(n).padStart(6, "0")
  return `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4, 6)}`
}

// 兼容导出
export type { SectorFlow }

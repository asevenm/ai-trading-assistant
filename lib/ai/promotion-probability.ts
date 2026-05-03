import { getLimitUpPool, type LimitUpPoolStock } from "../theme-radar-api"
import { getSectorFlow } from "../sector-flow-api"

// ==================== Types ====================

export interface PromotionScore {
  code: string
  name: string
  consecutiveBoards: number
  /** 当前板位预测："首板→2板"、"2板→3板"... */
  promotionTarget: string
  /** 进阶概率 0-100 */
  probability: number
  /** 评级 */
  level: "low" | "medium" | "high" | "veryHigh"
  /** 加分项 */
  positives: string[]
  /** 减分项 */
  negatives: string[]
}

export interface PromotionScoreInput {
  stock: LimitUpPoolStock
  /** 流通市值 */
  circulationMarketCap: number
  /** 同梯队（同连板数）股票数 */
  peerCount: number
  /** 所属概念/行业的板块强度 0-100 */
  themeStrength: number
  /** 所属板块今日涨幅% */
  themeChangePercent: number
}

// ==================== 主入口 ====================

/**
 * 批量给当日涨停池打"明日进阶概率"分
 *
 * 进阶 = 1板 → 2板 / 2板 → 3板 / ...
 */
export async function scoreLimitUpPromotions(): Promise<PromotionScore[]> {
  const pool = await getLimitUpPool()
  if (pool.length === 0) return []

  // 取板块流（含行业 + 概念）建立板块强度查询
  const [industryFlow, conceptFlow] = await Promise.all([
    getSectorFlow("industry", 200),
    getSectorFlow("concept", 500),
  ])
  const themeFlow = new Map<string, { changePercent: number; mainNetInflow: number }>()
  for (const f of [...industryFlow, ...conceptFlow]) {
    themeFlow.set(f.name, {
      changePercent: f.changePercent,
      mainNetInflow: f.mainNetInflow,
    })
  }

  // 同梯队（连板数相同）的票数
  const peerCountByBoards = new Map<number, number>()
  for (const s of pool) {
    peerCountByBoards.set(
      s.consecutiveBoards,
      (peerCountByBoards.get(s.consecutiveBoards) ?? 0) + 1
    )
  }

  // 每只票的所有概念中找最强的板块
  const themeStrengthOf = (stock: LimitUpPoolStock): { strength: number; change: number } => {
    const tags = [stock.industry, ...stock.concepts].filter(Boolean)
    let bestStrength = 0
    let bestChange = 0
    for (const tag of tags) {
      const f = themeFlow.get(tag)
      if (!f) continue
      // 板块强度 = 涨幅 ×8 + 主力净流入(亿) ×2，归一到 0-100
      const inflowYi = f.mainNetInflow / 1e8
      const s = Math.max(0, Math.min(100, f.changePercent * 8 + inflowYi * 2))
      if (s > bestStrength) {
        bestStrength = s
        bestChange = f.changePercent
      }
    }
    return { strength: bestStrength, change: bestChange }
  }

  // 流通市值（批量）
  const caps = await getCirculationMarketCaps(pool.map((s) => s.code))

  return pool
    .map((stock) => {
      const ts = themeStrengthOf(stock)
      const score = computePromotionProbability({
        stock,
        circulationMarketCap: caps.get(stock.code) ?? 0,
        peerCount: peerCountByBoards.get(stock.consecutiveBoards) ?? 1,
        themeStrength: ts.strength,
        themeChangePercent: ts.change,
      })
      return score
    })
    .sort((a, b) => b.probability - a.probability)
}

// ==================== 评分核心 ====================

/**
 * 单股进阶概率打分
 *
 * 评分维度（满分 100）：
 * - 封单厚度（封单/流通市值）   25
 * - 板块强度（主线/支线/弱势）  20
 * - 同梯队人数（抱团强度）       15
 * - 一字板/封板时间             15
 * - 量比/换手率                  10
 * - 炸板情况                     -10 ~ 0
 * - 高位连板分歧                 -15 ~ 0
 */
export function computePromotionProbability(input: PromotionScoreInput): PromotionScore {
  const positives: string[] = []
  const negatives: string[] = []
  let prob = 30 // 起始基础分（市场平均进阶率约 30%）

  const {
    stock,
    circulationMarketCap,
    peerCount,
    themeStrength,
    themeChangePercent,
  } = input

  // 1. 封单厚度
  const sealRatio = circulationMarketCap > 0
    ? (stock.sealAmount / circulationMarketCap) * 100
    : 0
  if (sealRatio >= 5) {
    prob += 25
    positives.push(`封单极厚(${sealRatio.toFixed(1)}%)`)
  } else if (sealRatio >= 3) {
    prob += 18
    positives.push(`封单厚(${sealRatio.toFixed(1)}%)`)
  } else if (sealRatio >= 1.5) {
    prob += 10
    positives.push(`封单中等(${sealRatio.toFixed(1)}%)`)
  } else if (sealRatio < 0.5 && sealRatio > 0) {
    prob -= 5
    negatives.push(`封单薄(${sealRatio.toFixed(2)}%)`)
  }

  // 2. 板块强度
  if (themeStrength >= 50) {
    prob += 20
    positives.push(`主线板块(${themeChangePercent.toFixed(1)}%)`)
  } else if (themeStrength >= 25) {
    prob += 12
    positives.push(`板块强势`)
  } else if (themeStrength >= 10) {
    prob += 5
  } else {
    prob -= 5
    negatives.push("板块偏弱")
  }

  // 3. 同梯队抱团（量化时代特征：同高度的票越多越敢做）
  if (stock.consecutiveBoards >= 2) {
    if (peerCount >= 3) {
      prob += 15
      positives.push(`${stock.consecutiveBoards}板梯队${peerCount}只`)
    } else if (peerCount === 2) {
      prob += 8
      positives.push(`${stock.consecutiveBoards}板梯队双雄`)
    } else {
      prob -= 5
      negatives.push(`孤独${stock.consecutiveBoards}板`)
    }
  } else {
    // 首板：同板池子大说明市场情绪好
    if (peerCount >= 30) {
      prob += 8
      positives.push("首板池充裕")
    } else if (peerCount < 10) {
      prob -= 3
      negatives.push("首板池稀薄")
    }
  }

  // 4. 一字板 / 封板时间
  const sealMinutes = parseTimeToMinutes(stock.firstSealTime)
  if (stock.bustCount === 0 && stock.turnoverRate < 1.5 && sealMinutes < 9 * 60 + 35) {
    // 极低换手 + 早盘秒板 → 接近一字板
    prob += 15
    positives.push("一字/秒板")
  } else if (sealMinutes < 10 * 60) {
    prob += 8
    positives.push("早盘封板")
  } else if (sealMinutes >= 14 * 60) {
    prob -= 8
    negatives.push("尾盘封板")
  } else if (sealMinutes >= 13 * 60 + 30) {
    prob -= 4
    negatives.push("午后封板")
  }

  // 5. 量比/换手
  if (stock.turnoverRate >= 5 && stock.turnoverRate <= 15 && stock.consecutiveBoards <= 2) {
    prob += 10
    positives.push(`换手健康(${stock.turnoverRate.toFixed(1)}%)`)
  } else if (stock.turnoverRate > 25) {
    prob -= 6
    negatives.push(`换手过高(${stock.turnoverRate.toFixed(0)}%)`)
  }

  // 6. 炸板减分
  if (stock.bustCount >= 2) {
    prob -= 10
    negatives.push(`今日炸${stock.bustCount}次`)
  } else if (stock.bustCount === 1) {
    prob -= 5
    negatives.push("今日曾炸1次")
  }

  // 7. 高位分歧
  if (stock.consecutiveBoards >= 6) {
    prob -= 15
    negatives.push(`${stock.consecutiveBoards}板高位`)
  } else if (stock.consecutiveBoards === 5) {
    prob -= 8
    negatives.push("5板分歧位")
  } else if (stock.consecutiveBoards === 4) {
    prob -= 3
    negatives.push("4板半路")
  }

  const probability = Math.max(0, Math.min(100, Math.round(prob)))
  const level: PromotionScore["level"] =
    probability >= 75 ? "veryHigh" : probability >= 55 ? "high" : probability >= 35 ? "medium" : "low"

  const targetBoard = stock.consecutiveBoards + 1
  const promotionTarget =
    stock.consecutiveBoards === 1
      ? "首板→2板"
      : `${stock.consecutiveBoards}板→${targetBoard}板`

  return {
    code: stock.code,
    name: stock.name,
    consecutiveBoards: stock.consecutiveBoards,
    promotionTarget,
    probability,
    level,
    positives,
    negatives,
  }
}

// ==================== Helpers ====================

function parseTimeToMinutes(hms: string): number {
  // hms 格式如 "09:30:05"，也兼容 "093005"
  if (hms.includes(":")) {
    const [h, m] = hms.split(":")
    return Number(h) * 60 + Number(m)
  }
  if (hms.length >= 4) {
    return Number(hms.slice(0, 2)) * 60 + Number(hms.slice(2, 4))
  }
  return 0
}

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

async function getCirculationMarketCaps(codes: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (codes.length === 0) return map

  try {
    const secids = codes
      .map((c) => `${c.startsWith("6") ? "1" : "0"}.${c}`)
      .join(",")

    const url =
      `https://push2.eastmoney.com/api/qt/ulist.np/get` +
      `?secids=${secids}&fields=f12,f20` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result?.data?.diff) return map

    const items = Array.isArray(result.data.diff)
      ? result.data.diff
      : Object.values(result.data.diff)

    for (const item of items) {
      const code = String((item as Record<string, unknown>).f12 ?? "")
      const cap = Number((item as Record<string, unknown>).f20) || 0
      if (code) map.set(code, cap)
    }
  } catch (error) {
    console.error("Failed to fetch market caps:", error)
  }

  return map
}

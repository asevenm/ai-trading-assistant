import { getLimitUpPool, type LimitUpPoolStock } from "./theme-radar-api"
import { getStockKline } from "./market-api"
import { getLimitUpPrice } from "./limit-rules"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface SealOrderStock extends LimitUpPoolStock {
  circulationMarketCap: number // 流通市值（元）
  sealRatio: number // 封单/流通市值 百分比
  bustProbability: number // 炸板概率评分 0-100（越高越危险）
  bustRiskLevel: "low" | "medium" | "high" | "critical"
  bustFactors: string[] // 风险因子
}

export interface LimitUpCalcResult {
  code: string
  name: string
  limitPrice: number
  currentPrice: number
  sealAmount: number
  inputFund: number // 输入资金（元）
  buyableShares: number // 可买股数（按手）
  estimatedCost: number // 实际成本
  queuePositionPercent: number // 估计排队位置（百分比）
  successProbability: "低" | "中" | "高"
  suggestion: string
}

// ==================== 封单强度排行 ====================

/**
 * 获取封单强度排行（在涨停池基础上补充流通市值）
 */
export async function getSealOrderRanking(date?: string): Promise<SealOrderStock[]> {
  const pool = await getLimitUpPool(date)
  if (pool.length === 0) return []

  // 批量获取流通市值
  const caps = await getCirculationMarketCaps(pool.map((s) => s.code))

  const result = pool.map((stock) => {
    const cap = caps.get(stock.code) ?? 0
    const sealRatio = cap > 0 ? (stock.sealAmount / cap) * 100 : 0

    const { probability, level, factors } = computeBustProbability({
      sealAmount: stock.sealAmount,
      circulationMarketCap: cap,
      bustCount: stock.bustCount,
      consecutiveBoards: stock.consecutiveBoards,
      firstSealTime: stock.firstSealTime,
      turnoverRate: stock.turnoverRate,
    })

    return {
      ...stock,
      circulationMarketCap: cap,
      sealRatio,
      bustProbability: probability,
      bustRiskLevel: level,
      bustFactors: factors,
    }
  })

  // 按封单金额排序
  return result.sort((a, b) => b.sealAmount - a.sealAmount)
}

async function getCirculationMarketCaps(codes: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (codes.length === 0) return map

  try {
    // 用 secids 批量查
    const secids = codes
      .map((c) => {
        const market = c.startsWith("6") ? "1" : "0"
        return `${market}.${c}`
      })
      .join(",")

    const url =
      `https://push2.eastmoney.com/api/qt/ulist.np/get` +
      `?secids=${secids}` +
      `&fields=f12,f20` +
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

/**
 * 炸板概率评分 0-100（越高越危险）
 *
 * 主要因子：
 * - 封单/流通市值 < 1% → 封单薄，易炸 (权重 35)
 * - 已开板次数 > 0 → 已炸过一次 (权重 25)
 * - 封板时间 > 13:30 → 尾盘封板承接弱 (权重 15)
 * - 连板 >= 4 → 高位分歧风险 (权重 15)
 * - 换手率 > 20% → 筹码松动 (权重 10)
 */
function computeBustProbability(input: {
  sealAmount: number
  circulationMarketCap: number
  bustCount: number
  consecutiveBoards: number
  firstSealTime: string
  turnoverRate: number
}): {
  probability: number
  level: "low" | "medium" | "high" | "critical"
  factors: string[]
} {
  const factors: string[] = []
  let risk = 0

  // 封单比例
  const sealRatio = input.circulationMarketCap > 0
    ? (input.sealAmount / input.circulationMarketCap) * 100
    : 0
  if (sealRatio < 1) {
    risk += 35
    factors.push(`封单薄(${sealRatio.toFixed(2)}%<1%)`)
  } else if (sealRatio < 2) {
    risk += 20
    factors.push(`封单中等(${sealRatio.toFixed(2)}%)`)
  } else if (sealRatio > 5) {
    risk -= 5
    factors.push(`封单厚(${sealRatio.toFixed(1)}%)`)
  }

  // 炸板次数
  if (input.bustCount >= 2) {
    risk += 25
    factors.push(`已炸${input.bustCount}次`)
  } else if (input.bustCount === 1) {
    risk += 12
    factors.push("曾炸1次")
  }

  // 封板时间
  const hour = parseInt(input.firstSealTime.split(":")[0] || "0", 10)
  const minute = parseInt(input.firstSealTime.split(":")[1] || "0", 10)
  const totalMinutes = hour * 60 + minute
  if (totalMinutes >= 14 * 60) {
    risk += 15
    factors.push("尾盘封板")
  } else if (totalMinutes >= 13.5 * 60) {
    risk += 8
    factors.push("午后封板")
  }

  // 连板数
  if (input.consecutiveBoards >= 5) {
    risk += 15
    factors.push(`${input.consecutiveBoards}板高位`)
  } else if (input.consecutiveBoards >= 4) {
    risk += 8
    factors.push("4板位置")
  }

  // 换手率
  if (input.turnoverRate > 30) {
    risk += 10
    factors.push(`换手高(${input.turnoverRate.toFixed(0)}%)`)
  }

  const probability = Math.max(0, Math.min(100, risk))
  const level: "low" | "medium" | "high" | "critical" =
    probability < 20 ? "low" : probability < 45 ? "medium" : probability < 70 ? "high" : "critical"

  return { probability, level, factors }
}

// ==================== 打板计算器 ====================

/**
 * 打板计算器：给出打板参考
 */
export async function calculateLimitUpOrder(input: {
  code: string
  fundAmount: number // 资金（元）
}): Promise<LimitUpCalcResult | null> {
  try {
    const pool = await getLimitUpPool()
    const stock = pool.find((s) => s.code === input.code)
    if (!stock) return null

    // 涨停价 = 昨收 × 涨幅限制（按板块/ST识别）
    const klines = await getStockKline(input.code, "daily", 3)
    const prevClose = klines.length >= 2 ? klines[klines.length - 2].close : stock.price
    const limitPrice = getLimitUpPrice(input.code, prevClose, stock.name)

    // 可买股数（100股一手向下取整）
    const shares = Math.floor(input.fundAmount / limitPrice / 100) * 100
    const cost = shares * limitPrice

    // 估计排队位置（近似：同等资金排在你前面的比例）
    // 假设封单金额为现有封单，你的单排在最后
    const totalAfter = stock.sealAmount + cost
    const queuePositionPercent = totalAfter > 0 ? (stock.sealAmount / totalAfter) * 100 : 0

    const successProbability = computeSuccessProb(stock, cost)

    const suggestion = generateSuggestion(stock, input.fundAmount, cost, queuePositionPercent)

    return {
      code: stock.code,
      name: stock.name,
      limitPrice,
      currentPrice: stock.price,
      sealAmount: stock.sealAmount,
      inputFund: input.fundAmount,
      buyableShares: shares,
      estimatedCost: cost,
      queuePositionPercent,
      successProbability,
      suggestion,
    }
  } catch (error) {
    console.error("Calculate limit-up order failed:", error)
    return null
  }
}

function computeSuccessProb(stock: LimitUpPoolStock, cost: number): "低" | "中" | "高" {
  // 如果已经炸板2次+，次日打板难度大
  if (stock.bustCount >= 2) return "低"
  // 如果是已涨停且封单厚（你的资金占比<10%），成功率高
  if (stock.sealAmount > 0 && cost / stock.sealAmount < 0.1) return "高"
  // 中等情况
  return "中"
}

function generateSuggestion(
  stock: LimitUpPoolStock,
  fundAmount: number,
  cost: number,
  queuePosition: number
): string {
  const parts: string[] = []

  if (stock.bustCount > 0) {
    parts.push(`⚠ 该股已开板${stock.bustCount}次，回封不稳定`)
  }

  if (queuePosition > 95) {
    parts.push(`排队靠后(${queuePosition.toFixed(0)}%)，成交概率低`)
  } else if (queuePosition < 50) {
    parts.push(`排队靠前，封单吃单后可成交`)
  }

  if (stock.consecutiveBoards >= 4) {
    parts.push(`已${stock.consecutiveBoards}板，高位分歧风险大`)
  } else if (stock.consecutiveBoards === 1) {
    parts.push(`首板，次日溢价空间取决于板块强度`)
  }

  if (cost < fundAmount * 0.8) {
    parts.push(`可买${cost.toLocaleString()}元，资金利用率${((cost / fundAmount) * 100).toFixed(0)}%`)
  }

  return parts.join("；") || "可尝试打板"
}

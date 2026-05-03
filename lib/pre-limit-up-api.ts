import { normalizeDiff } from "./market-api"
import {
  distanceToLimitUp,
  getBoardType,
  getLimitUpPercent,
  getLimitUpPrice,
  isLimitUp,
} from "./limit-rules"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface PreLimitUpCandidate {
  code: string
  name: string
  price: number
  changePercent: number // 当前涨幅
  distanceToLimit: number // 距涨停的百分比 (0.5 表示还差 0.5%)
  speed: number // 涨速（近1分钟涨幅）
  volumeRatio: number // 量比
  turnoverRate: number // 换手率
  amount: number // 成交额
  mainNetInflow: number // 主力净流入
  superLargeInflow: number // 超大单净流入
  industry: string
  circulationMarketCap: number
  isGrowthBoard: boolean
  limitPrice: number // 涨停价
  score: number // 综合评分 0-100
  signals: string[] // 触发的信号
}

// ==================== 预涨停扫描 ====================

/**
 * 扫描即将涨停的股票
 * 策略：
 * - 距涨停 ≤5% 进入候选池（主板 5%-9.9%、创业板/科创板 15%-19.9%、北交所 25%-29.9%）
 * - 按涨速(f22)排序，筛出快速拉升的
 * - 结合量比、主力流入打分
 */
export async function scanPreLimitUp(): Promise<PreLimitUpCandidate[]> {
  try {
    // 取涨幅>=5% 的所有股票，按涨速排序（f22）
    // 服务端宽过滤，客户端按板块阈值精确过滤
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get` +
      `?pn=1&pz=300&po=1&fid=f22` +
      `&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23` +
      `&fields=f2,f3,f5,f6,f8,f10,f12,f14,f15,f16,f17,f18,f20,f22,f62,f66,f72,f100` +
      `&fltt=2&ut=fa5fd1943c7b386f172d6893dbfba10b` +
      `&fl=f3>=5`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.data?.diff) return []

    const candidates: PreLimitUpCandidate[] = []

    for (const item of normalizeDiff(result.data.diff)) {
      const code = String(item.f12)
      const name = String(item.f14)

      // 过滤 ST、*ST、退市
      if (name.includes("ST") || name.includes("退")) continue

      const board = getBoardType(code)
      if (board === "unknown") continue
      const isGrowthBoard = board === "chinext" || board === "star"
      const limitPercent = getLimitUpPercent(code, name)
      // 进入候选池：距涨停 ≤5%（北交所放宽到 ≤5%，因 30cm 振幅大）
      const lowerBound = limitPercent - 5

      const change = Number(item.f3)
      if (isLimitUp(code, change, name)) continue // 已涨停，跳过
      if (change < lowerBound) continue

      const prevClose = Number(item.f18) || 0
      const price = Number(item.f2) || 0
      const limitPrice = getLimitUpPrice(code, prevClose, name)
      const distanceToLimit = distanceToLimitUp(code, change, name)

      const speed = Number(item.f22) || 0 // 涨速
      const volumeRatio = Number(item.f10) || 0 // 量比
      const turnoverRate = Number(item.f8) || 0
      const amount = Number(item.f6) || 0
      const mainInflow = Number(item.f62) || 0
      const superLargeInflow = Number(item.f66) || 0
      const high = Number(item.f15) || 0
      const circulationMarketCap = Number(item.f20) || 0

      // 触及过涨停但开板的，单独标记
      const touchedLimit = high >= limitPrice * 0.999

      const { score, signals } = computeScore({
        change,
        distanceToLimit,
        speed,
        volumeRatio,
        mainInflow,
        superLargeInflow,
        touchedLimit,
        circulationMarketCap,
      })

      // 最低分过滤
      if (score < 30) continue

      candidates.push({
        code,
        name,
        price,
        changePercent: change,
        distanceToLimit,
        speed,
        volumeRatio,
        turnoverRate,
        amount,
        mainNetInflow: mainInflow,
        superLargeInflow,
        industry: String(item.f100 || ""),
        circulationMarketCap,
        isGrowthBoard,
        limitPrice,
        score,
        signals,
      })
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 50)
  } catch (error) {
    console.error("Failed to scan pre-limit-up:", error)
    return []
  }
}

/**
 * 综合评分
 * 权重：
 * - 距涨停越近分越高 (25)
 * - 涨速（1分钟变化）越快越高 (25)
 * - 量比 > 2 越大越高 (15)
 * - 主力净流入为正 (20)
 * - 超大单净流入为正 (15)
 * 加分：曾触及涨停但开板 +10 (回封概率高)
 * 减分：流通市值 > 500亿 -10 (大票难封板)
 */
function computeScore(input: {
  change: number
  distanceToLimit: number
  speed: number
  volumeRatio: number
  mainInflow: number
  superLargeInflow: number
  touchedLimit: boolean
  circulationMarketCap: number
}): { score: number; signals: string[] } {
  const signals: string[] = []

  // 距涨停越近分越高 (0-25)
  const distanceScore = Math.max(0, 25 - input.distanceToLimit * 10)
  if (input.distanceToLimit < 1) signals.push("⚡ 一步之遥")

  // 涨速 (0-25)
  const speedScore = Math.min(input.speed * 8, 25)
  if (input.speed >= 1.5) signals.push("🚀 快速拉升")

  // 量比 (0-15)
  const volScore = Math.min((input.volumeRatio - 1) * 3, 15)
  if (input.volumeRatio >= 3) signals.push("📈 量比放大")

  // 主力净流入 (0-20)
  const mainScore = input.mainInflow > 0
    ? Math.min((input.mainInflow / 1e8) * 4, 20)
    : Math.max((input.mainInflow / 1e8) * 2, -10)
  if (input.mainInflow > 5e7) signals.push("💰 主力吸筹")

  // 超大单 (0-15)
  const superScore = input.superLargeInflow > 0
    ? Math.min((input.superLargeInflow / 1e8) * 3, 15)
    : 0
  if (input.superLargeInflow > 3e7) signals.push("🐋 超大单净流入")

  // 回封加分
  const bonusReseal = input.touchedLimit ? 10 : 0
  if (input.touchedLimit) signals.push("🎯 触及涨停")

  // 大票减分
  const penaltyLargeCap = input.circulationMarketCap > 5e10 ? -10 : 0
  if (input.circulationMarketCap > 5e10) signals.push("⚠ 流通盘较大")

  const raw =
    distanceScore + speedScore + volScore + mainScore + superScore + bonusReseal + penaltyLargeCap
  const score = Math.max(0, Math.min(100, Math.round(raw)))

  return { score, signals }
}

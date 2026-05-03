import { getBillboardHistory, getBillboardDetail, FAMOUS_SEATS } from "./billboard-api"

// ==================== Types ====================

export interface GuestSeatStats {
  seatName: string
  type: "hotmoney" | "institution" | "connect" | "broker"
  isFamous: boolean
  appearances: number // 上榜次数
  totalBuy: number
  totalSell: number
  netAmount: number
  stocks: { code: string; name: string; date: string; net: number }[]
  preferredIndustries: { name: string; count: number }[]
}

export interface RisingGuest {
  seatName: string
  recentCount: number // 近7日出手次数
  previousCount: number // 前7日出手次数
  growthRate: number // 增长倍数
  recentStocks: { code: string; name: string; date: string }[]
}

export interface GuestTrackerSnapshot {
  period: string // "近5日" / "近10日"
  days: number
  famousGuests: GuestSeatStats[] // 知名游资
  risingGuests: RisingGuest[] // 新晋活跃游资
  topSeats: GuestSeatStats[] // 出手最频繁的席位
}

// ==================== 游资追踪主流程 ====================

/**
 * 聚合近 N 日龙虎榜数据，生成游资席位统计
 * 注意：数据量随天数线性增加，默认 5 日
 */
export async function getGuestTrackerSnapshot(days: number = 5): Promise<GuestTrackerSnapshot> {
  const history = await getBillboardHistory(days)
  if (history.length === 0) {
    return emptySnapshot(days)
  }

  // 为避免触发服务端过载，只拉取 Top 30 的股票的席位详情
  // 按成交额排序，重点关注大资金标的
  const topStocks = [...history]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 30)

  const details = await Promise.all(
    topStocks.map((s) => getBillboardDetail(s.code, s.date))
  )

  // 聚合席位
  const seatMap = new Map<string, GuestSeatStats>()
  for (let i = 0; i < details.length; i++) {
    const detail = details[i]
    if (!detail) continue
    const stock = topStocks[i]

    for (const seat of [...detail.buySeats, ...detail.sellSeats]) {
      const existing = seatMap.get(seat.seatName) ?? createSeatStats(seat.seatName, seat.type)
      const next: GuestSeatStats = {
        ...existing,
        appearances: existing.appearances + 1,
        totalBuy: existing.totalBuy + seat.buyAmount,
        totalSell: existing.totalSell + seat.sellAmount,
        netAmount: existing.netAmount + seat.netAmount,
        stocks: [
          ...existing.stocks,
          { code: stock.code, name: stock.name, date: stock.date, net: seat.netAmount },
        ],
      }
      seatMap.set(seat.seatName, next)
    }
  }

  // 按席位偏好行业聚合（从上榜原因提取关键词作为粗粒度行业）
  const allSeats = Array.from(seatMap.values()).map((s) => ({
    ...s,
    preferredIndustries: extractPreferredIndustries(s, topStocks),
  }))

  const famousGuests = allSeats
    .filter((s) => s.isFamous)
    .sort((a, b) => b.appearances - a.appearances)

  const topSeats = [...allSeats]
    .filter((s) => s.type !== "connect")
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 15)

  const risingGuests = computeRisingGuests(history, allSeats, days)

  return {
    period: `近${days}日`,
    days,
    famousGuests,
    risingGuests,
    topSeats,
  }
}

function createSeatStats(
  seatName: string,
  seatType: string
): GuestSeatStats {
  const isFamous = FAMOUS_SEATS.some((s) => seatName.includes(s))
  const type = (seatType === "hotmoney" || seatType === "institution" ||
    seatType === "connect" || seatType === "broker")
    ? seatType
    : "broker"

  return {
    seatName,
    type: type as GuestSeatStats["type"],
    isFamous,
    appearances: 0,
    totalBuy: 0,
    totalSell: 0,
    netAmount: 0,
    stocks: [],
    preferredIndustries: [],
  }
}

/**
 * 从上榜原因提取粗粒度关键词作为行业偏好
 * 例如 "日涨幅偏离值达7%" -> 无行业信息
 * "连续三个交易日内涨幅偏离值累计达20%" -> 无行业
 * 实际上这里能拿到的只有股票代码，行业需要从其他来源推断
 */
function extractPreferredIndustries(
  seat: GuestSeatStats,
  allStocks: { code: string; name: string }[]
): { name: string; count: number }[] {
  // 占位：从股票名字简单推断（包含关键词）
  const keywords = ["科技", "医药", "新能源", "半导体", "军工", "AI", "机器人", "数据", "化工"]
  const counter = new Map<string, number>()

  for (const stock of seat.stocks) {
    const full = allStocks.find((a) => a.code === stock.code)?.name ?? stock.name
    for (const kw of keywords) {
      if (full.includes(kw)) {
        counter.set(kw, (counter.get(kw) ?? 0) + 1)
      }
    }
  }

  return Array.from(counter.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

/**
 * 对比近期和前期的上榜频率，找出活跃度明显上升的游资
 */
function computeRisingGuests(
  history: { code: string; name: string; date: string }[],
  allSeats: GuestSeatStats[],
  days: number
): RisingGuest[] {
  if (history.length === 0 || allSeats.length === 0) return []

  const midpoint = new Date()
  midpoint.setDate(midpoint.getDate() - Math.floor(days / 2))
  const midpointStr = midpoint.toISOString().split("T")[0]

  return allSeats
    .filter((s) => !s.isFamous && s.type !== "connect" && s.appearances >= 2)
    .map((seat) => {
      const recent = seat.stocks.filter((s) => s.date >= midpointStr).length
      const previous = seat.stocks.filter((s) => s.date < midpointStr).length
      const growthRate = previous === 0 ? recent : recent / previous

      return {
        seatName: seat.seatName,
        recentCount: recent,
        previousCount: previous,
        growthRate,
        recentStocks: seat.stocks
          .filter((s) => s.date >= midpointStr)
          .slice(0, 5)
          .map(({ code, name, date }) => ({ code, name, date })),
      }
    })
    .filter((g) => g.growthRate >= 2 && g.recentCount >= 2)
    .sort((a, b) => b.growthRate - a.growthRate)
    .slice(0, 10)
}

function emptySnapshot(days: number): GuestTrackerSnapshot {
  return {
    period: `近${days}日`,
    days,
    famousGuests: [],
    risingGuests: [],
    topSeats: [],
  }
}

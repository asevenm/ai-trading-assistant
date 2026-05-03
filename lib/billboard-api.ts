const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface BillboardStock {
  tradeId: number // 龙虎榜条目唯一ID（同一股票同日多次上榜会有多条）
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  netBuyAmount: number // 净买入额
  buyAmount: number
  sellAmount: number
  totalAmount: number // 龙虎榜成交额
  reason: string // 上榜原因
  date: string
}

export interface BillboardSeat {
  seatName: string
  buyAmount: number
  sellAmount: number
  netAmount: number
  type: string // "institution" | "broker" | "connect"
}

export interface BillboardDetail {
  code: string
  name: string
  changePercent: number
  reason: string
  buySeats: BillboardSeat[]
  sellSeats: BillboardSeat[]
  totalBuy: number
  totalSell: number
  netBuy: number
}

// ==================== Today Billboard ====================

export async function getTodayBillboard(): Promise<BillboardStock[]> {
  try {
    // Use a 7-day window then pick the latest date in JS — robust against
    // weekends, holidays, and the case where today's data isn't published yet.
    const since = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DAILYBILLBOARD_DETAILSNEW&columns=ALL&filter=(TRADE_DATE%3E%27${since}%27)&pageNumber=1&pageSize=200&sortColumns=TRADE_DATE,SECURITY_CODE&sortTypes=-1,1&source=WEB&client=WEB&_=${Date.now()}`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    const rawData = result.result?.data as Record<string, unknown>[] | undefined
    if (!rawData || rawData.length === 0) return []

    const mostRecentDate = String(rawData[0].TRADE_DATE || "").slice(0, 10)
    const todayRows = rawData.filter(
      (item) => String(item.TRADE_DATE || "").slice(0, 10) === mostRecentDate
    )

    return todayRows.map((item) => ({
      tradeId: Number(item.TRADE_ID || 0),
      code: String(item.SECURITY_CODE || ""),
      name: String(item.SECURITY_NAME_ABBR || ""),
      price: Number(item.CLOSE_PRICE || 0),
      changePercent: Number(item.CHANGE_RATE || 0),
      turnoverRate: Number(item.TURNOVERRATE || 0),
      netBuyAmount: Number(item.BILLBOARD_NET_AMT || 0),
      buyAmount: Number(item.BILLBOARD_BUY_AMT || 0),
      sellAmount: Number(item.BILLBOARD_SELL_AMT || 0),
      totalAmount: Number(item.BILLBOARD_DEAL_AMT || 0),
      reason: String(item.EXPLAIN || ""),
      date: String(item.TRADE_DATE || "").slice(0, 10),
    }))
  } catch (error) {
    console.error("Failed to fetch billboard:", error)
    return []
  }
}

// ==================== Billboard Detail (seats) ====================

export async function getBillboardDetail(
  code: string,
  date?: string
): Promise<BillboardDetail | null> {
  try {
    const tradeDate = date || getRecentTradeDate()
    const buildUrl = (report: string, sortCol: string) =>
      `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=${report}&columns=ALL&filter=(TRADE_DATE%3D%27${tradeDate}%27)(SECURITY_CODE%3D%22${code}%22)&pageNumber=1&pageSize=20&sortColumns=${sortCol}&sortTypes=-1&source=WEB&client=WEB&_=${Date.now()}`

    const [buyRes, sellRes] = await Promise.all([
      fetch(buildUrl("RPT_BILLBOARD_DAILYDETAILSBUY", "BUY"), {
        headers: EAST_MONEY_HEADERS,
        cache: "no-store",
      }),
      fetch(buildUrl("RPT_BILLBOARD_DAILYDETAILSSELL", "SELL"), {
        headers: EAST_MONEY_HEADERS,
        cache: "no-store",
      }),
    ])

    const buyResult = await buyRes.json()
    const sellResult = await sellRes.json()

    const buyData = (buyResult.result?.data || []) as Record<string, unknown>[]
    const sellData = (sellResult.result?.data || []) as Record<string, unknown>[]

    const toSeat = (item: Record<string, unknown>): BillboardSeat => {
      const buy = Number(item.BUY || 0)
      const sell = Number(item.SELL || 0)
      return {
        seatName: String(item.OPERATEDEPT_NAME || ""),
        buyAmount: buy,
        sellAmount: sell,
        netAmount: Number(item.NET ?? buy - sell),
        type: classifySeat(String(item.OPERATEDEPT_NAME || "")),
      }
    }

    const buySeats = buyData.map(toSeat)
    const sellSeats = sellData.map(toSeat)

    if (buySeats.length === 0 && sellSeats.length === 0) return null

    const totalBuy = buySeats.reduce((sum, s) => sum + s.buyAmount, 0)
    const totalSell = sellSeats.reduce((sum, s) => sum + s.sellAmount, 0)

    const firstRow = (buyData[0] || sellData[0]) as Record<string, unknown> | undefined
    return {
      code,
      name: String(firstRow?.SECURITY_NAME_ABBR || ""),
      changePercent: Number(firstRow?.CHANGE_RATE || 0),
      reason: String(firstRow?.EXPLANATION || ""),
      buySeats,
      sellSeats,
      totalBuy,
      totalSell,
      netBuy: totalBuy - totalSell,
    }
  } catch (error) {
    console.error("Failed to fetch billboard detail:", error)
    return null
  }
}

// ==================== Known Hot Money Seats (知名游资) ====================

const FAMOUS_SEATS = [
  "东方财富证券拉萨",
  "华鑫证券上海分公司",
  "国泰君安证券上海江苏路",
  "中信证券上海溧阳路",
  "华泰证券深圳益田路荣超商务中心",
  "中国银河证券绍兴",
  "东方财富证券拉萨团结路",
  "东方财富证券拉萨东环路",
  "国盛证券宁波桑田路",
  "方正证券杭州保俶路",
]

// ==================== Billboard History ====================

export async function getBillboardHistory(
  days: number = 5
): Promise<BillboardStock[]> {
  try {
    const since = new Date(Date.now() - days * 2 * 86400000)
      .toISOString()
      .split("T")[0]

    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DAILYBILLBOARD_DETAILSNEW&columns=ALL&filter=(TRADE_DATE%3E%27${since}%27)&pageNumber=1&pageSize=200&sortColumns=TRADE_DATE,SECURITY_CODE&sortTypes=-1,1&source=WEB&client=WEB&_=${Date.now()}`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    if (!result.result?.data) return []

    return result.result.data.map((item: Record<string, unknown>) => ({
      tradeId: Number(item.TRADE_ID || 0),
      code: String(item.SECURITY_CODE || ""),
      name: String(item.SECURITY_NAME_ABBR || ""),
      price: Number(item.CLOSE_PRICE || 0),
      changePercent: Number(item.CHANGE_RATE || 0),
      turnoverRate: Number(item.TURNOVERRATE || 0),
      netBuyAmount: Number(item.BILLBOARD_NET_AMT || 0),
      buyAmount: Number(item.BILLBOARD_BUY_AMT || 0),
      sellAmount: Number(item.BILLBOARD_SELL_AMT || 0),
      totalAmount: Number(item.BILLBOARD_DEAL_AMT || 0),
      reason: String(item.EXPLAIN || ""),
      date: String(item.TRADE_DATE || "").slice(0, 10),
    }))
  } catch (error) {
    console.error("Failed to fetch billboard history:", error)
    return []
  }
}

// ==================== Helpers ====================

function getRecentTradeDate(): string {
  const now = new Date()
  const day = now.getDay()
  // If weekend, go back to Friday
  if (day === 0) now.setDate(now.getDate() - 2)
  else if (day === 6) now.setDate(now.getDate() - 1)
  return now.toISOString().split("T")[0]
}

function classifySeat(name: string): string {
  if (name.includes("机构专用")) return "institution"
  if (name.includes("沪股通") || name.includes("深股通") || name.includes("港股通")) return "connect"
  if (FAMOUS_SEATS.some((s) => name.includes(s))) return "hotmoney"
  return "broker"
}

export { FAMOUS_SEATS }

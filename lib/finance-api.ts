import { getSecId, isHKCode } from "./stock-api"

const EAST_MONEY_HEADERS = {
  Referer: "https://quote.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface FinancialData {
  code: string
  name: string
  pe: number
  pb: number
  totalMarketCap: number
  circulationMarketCap: number
  revenue: number
  netProfit: number
  roe: number
  debtRatio: number
  grossMargin: number
  netMargin: number
}

export interface StockProfile {
  code: string
  name: string
  industry: string
  listDate: string
  totalShares: number
  circulationShares: number
  mainBusiness: string
}

export interface ResearchReport {
  title: string
  orgName: string
  author: string
  rating: string
  date: string
  summary: string
}

// ==================== Financial Data ====================

export async function getFinancialData(
  code: string
): Promise<FinancialData | null> {
  try {
    const secid = getSecId(code)

    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58,f162,f167,f164,f163,f173,f183,f186,f187,f116,f117,f188,f190`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      next: { revalidate: 300 },
    })
    const result = await response.json()

    if (!result.data) return null

    const d = result.data
    return {
      code: String(d.f57),
      name: String(d.f58),
      pe: Number(d.f162) / 100,
      pb: Number(d.f167) / 100,
      totalMarketCap: Number(d.f116),
      circulationMarketCap: Number(d.f117),
      revenue: Number(d.f183),
      netProfit: Number(d.f186),
      roe: Number(d.f188) / 100,
      debtRatio: Number(d.f190) / 100,
      grossMargin: Number(d.f187) / 100,
      netMargin: Number(d.f173) / 100,
    }
  } catch (error) {
    console.error("Failed to fetch financial data:", error)
    return null
  }
}

// ==================== Stock Profile ====================

export async function getStockProfile(
  code: string
): Promise<StockProfile | null> {
  try {
    if (isHKCode(code)) return null // 港股公司概况接口格式不同，暂不支持
    const market = code.startsWith("6") ? "SH" : "SZ"
    const url = `https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/CompanySurveyAjax?code=${market}${code}`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      next: { revalidate: 86400 },
    })
    const result = await response.json()

    if (!result.jbzl) return null

    const info = result.jbzl
    return {
      code,
      name: info.gsmc || "",
      industry: info.sshy || "",
      listDate: info.ssrq || "",
      totalShares: parseFloat(info.zgsz) || 0,
      circulationShares: parseFloat(info.ltgb) || 0,
      mainBusiness: info.jyfw || "",
    }
  } catch (error) {
    console.error("Failed to fetch stock profile:", error)
    return null
  }
}

// ==================== Research Reports ====================

export async function getResearchReports(
  code: string,
  count: number = 10
): Promise<ResearchReport[]> {
  try {
    const url = `https://reportapi.eastmoney.com/report/list?industryCode=*&pageNo=1&pageSize=${count}&code=${code}&rptType=SECURITIES_RESEARCH_REPORT`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      next: { revalidate: 3600 },
    })
    const result = await response.json()

    if (!result.data) return []

    return result.data.map(
      (item: Record<string, string | string[]>) => ({
        title: String(item.title || ""),
        orgName: String(item.orgSName || ""),
        author: Array.isArray(item.researcher)
          ? item.researcher.join(",")
          : String(item.researcher || ""),
        rating: String(item.emRatingName || ""),
        date: String(item.publishDate || "").split(" ")[0],
        summary: String(item.content || item.title || ""),
      })
    )
  } catch (error) {
    console.error("Failed to fetch research reports:", error)
    return []
  }
}

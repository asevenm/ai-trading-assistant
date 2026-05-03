const EAST_MONEY_HEADERS = {
  Referer: "https://www.eastmoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// ==================== Types ====================

export interface StockAnnouncement {
  id: string
  code: string
  name: string
  title: string
  type: string // 公告类型
  url: string
  publishedAt: string // ISO
  summary?: string
}

export interface MarketNews {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string
  summary: string
  relatedCodes: string[]
}

// ==================== 公司公告 ====================

/**
 * 获取股票列表的最新公告
 * 东方财富公告接口：np-anotice-stock.eastmoney.com
 */
export async function getStockAnnouncements(
  codes: string[],
  days: number = 3
): Promise<StockAnnouncement[]> {
  if (codes.length === 0) return []

  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

  const results = await Promise.all(
    codes.map((code) => fetchAnnouncementsForStock(code, startDate, endDate))
  )

  return results
    .flat()
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

async function fetchAnnouncementsForStock(
  code: string,
  startDate: Date,
  endDate: Date
): Promise<StockAnnouncement[]> {
  try {
    const start = formatDateYMD(startDate)
    const end = formatDateYMD(endDate)

    const url =
      `https://np-anotice-stock.eastmoney.com/api/security/ann` +
      `?sr=-1&page_size=30&page_index=1` +
      `&ann_type=A&client_source=web&stock_list=${code}` +
      `&f_node=0&s_node=0&begin_time=${start}&end_time=${end}`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    const list = result?.data?.list
    if (!Array.isArray(list)) return []

    return list.map((item: Record<string, unknown>) => {
      const codes = (item.codes ?? []) as Array<{ stock_code: string; short_name: string }>
      const first = codes[0] ?? { stock_code: code, short_name: "" }
      const columns = (item.columns ?? []) as Array<{ column_name: string }>
      const typeName = columns[0]?.column_name ?? "公告"

      return {
        id: String(item.art_code ?? ""),
        code: first.stock_code,
        name: first.short_name,
        title: String(item.title ?? ""),
        type: typeName,
        url: `https://data.eastmoney.com/notices/detail/${first.stock_code}/${item.art_code}.html`,
        publishedAt: String(item.notice_date ?? ""),
      }
    })
  } catch (error) {
    console.error(`Failed to fetch announcements for ${code}:`, error)
    return []
  }
}

// ==================== 财经要闻 ====================

/**
 * 获取财经要闻（7x24快讯）
 */
export async function getMarketNews(count: number = 30): Promise<MarketNews[]> {
  try {
    const url =
      `https://np-weblist.eastmoney.com/comm/web/getFastNewsList` +
      `?client=web&biz=web_724&fastColumn=102` +
      `&sortEnd=&pageSize=${count}&req_trace=1`

    const response = await fetch(url, {
      headers: EAST_MONEY_HEADERS,
      cache: "no-store",
    })
    const result = await response.json()

    const list = result?.data?.fastNewsList
    if (!Array.isArray(list)) return []

    return list.map((item: Record<string, unknown>, idx: number) => ({
      id: String(item.code ?? `news-${idx}`),
      title: String(item.title ?? ""),
      source: "东方财富7x24",
      url: String(item.url ?? ""),
      publishedAt: String(item.showTime ?? item.pubDate ?? ""),
      summary: String(item.digest ?? item.summary ?? "").slice(0, 500),
      relatedCodes: parseRelatedCodes(item),
    }))
  } catch (error) {
    console.error("Failed to fetch market news:", error)
    return []
  }
}

function parseRelatedCodes(item: Record<string, unknown>): string[] {
  const stocks = item.stockList ?? item.stocks ?? []
  if (!Array.isArray(stocks)) return []
  return stocks
    .map((s) => {
      if (typeof s === "string") return s
      if (typeof s === "object" && s !== null) {
        const obj = s as Record<string, unknown>
        return String(obj.code ?? obj.stock_code ?? "")
      }
      return ""
    })
    .filter((c) => /^\d{6}$/.test(c))
}

// ==================== Utils ====================

function formatDateYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

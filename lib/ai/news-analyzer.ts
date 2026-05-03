import openai from "@/lib/openai"
import { SHORT_TERM_TRADING_PROMPT } from "./trading-philosophy"
import type { StockAnnouncement, MarketNews } from "@/lib/news-api"

export type NewsSentiment = "bullish" | "bearish" | "neutral"

export interface NewsAnalysis {
  sentiment: NewsSentiment
  strength: number // 0-10，利好/利空强度
  reason: string // 分析逻辑（30字内）
  impact: string // 预期影响（30字内）
  relatedConcepts: string[] // 联动概念板块
  tradeHint: string // 交易暗示（30字内）
}

/**
 * 批量分析公告
 */
export async function analyzeAnnouncements(
  announcements: StockAnnouncement[]
): Promise<Map<string, NewsAnalysis>> {
  if (announcements.length === 0) return new Map()

  // 只分析最近 20 条以控制成本
  const toAnalyze = announcements.slice(0, 20)

  const systemPrompt = `${SHORT_TERM_TRADING_PROMPT}

你是上市公司公告解读专家。用户给你一批公司公告标题，你需要快速判断每条的影响。

为每条公告输出：
1. sentiment: "bullish"(利好) / "bearish"(利空) / "neutral"(中性)
2. strength: 0-10 分（0=无影响，5=中等，10=重大）
3. reason: 判定理由（30字内）
4. impact: 预期股价/板块影响（30字内）
5. relatedConcepts: 可能联动的概念板块（数组，最多3个）
6. tradeHint: 短线操作提示（30字内）

重大利好示例（8-10分）：
- 收购重组、注入优质资产
- 重大合同中标（金额占营收>20%）
- 重要新产品发布（如AI/机器人相关）
- 业绩暴增（同比>100%）
- 重磅合作（与行业龙头）

重大利空示例（-8~-10分，sentiment=bearish, strength=高）：
- 业绩预亏/暴雷
- 被立案调查、监管处罚
- 重要股东减持
- 商誉减值、计提
- 诉讼败诉

输出严格 JSON 数组，顺序与输入一致：
[{ "sentiment": "...", "strength": 0, "reason": "...", "impact": "...", "relatedConcepts": [...], "tradeHint": "..." }]`

  const userPrompt = toAnalyze
    .map((a, i) => `[${i + 1}] ${a.name}(${a.code}) ${a.type}: ${a.title}`)
    .join("\n")

  const map = new Map<string, NewsAnalysis>()

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    })

    const content = response.choices[0].message.content
    if (!content) return map

    // 模型可能返回 { "results": [...] } 或 [...]
    const parsed = JSON.parse(content)
    const results: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : (parsed.results ?? parsed.items ?? parsed.analyses ?? [])

    toAnalyze.forEach((a, i) => {
      const analysis = results[i]
      if (analysis) map.set(a.id, normalizeAnalysis(analysis))
    })
  } catch (error) {
    console.error("Announcement analysis failed:", error)
  }

  return map
}

/**
 * 批量分析行业新闻
 */
export async function analyzeNews(news: MarketNews[]): Promise<Map<string, NewsAnalysis>> {
  if (news.length === 0) return new Map()

  const toAnalyze = news.slice(0, 15)

  const systemPrompt = `${SHORT_TERM_TRADING_PROMPT}

你是财经新闻解读专家。用户给你一批财经快讯，快速判断对市场/板块的影响。

为每条新闻输出：
1. sentiment: "bullish"/"bearish"/"neutral"
2. strength: 0-10 分（0=无影响，5=中等，10=重大，能带动板块）
3. reason: 判定理由（30字内）
4. impact: 预期影响（30字内）
5. relatedConcepts: 可能受益/受损的概念板块（数组，最多3个）
6. tradeHint: 短线操作提示（30字内）

强利好示例：
- 政策扶持（补贴/减税/审批放开）
- 技术突破（某行业重大进展）
- 大国合作/协议签订
- 产业链龙头订单

输出严格 JSON 数组，顺序与输入一致。`

  const userPrompt = toAnalyze
    .map((n, i) => `[${i + 1}] ${n.title}${n.summary ? " — " + n.summary.slice(0, 100) : ""}`)
    .join("\n")

  const map = new Map<string, NewsAnalysis>()

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    })

    const content = response.choices[0].message.content
    if (!content) return map

    const parsed = JSON.parse(content)
    const results: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : (parsed.results ?? parsed.items ?? parsed.analyses ?? [])

    toAnalyze.forEach((n, i) => {
      const analysis = results[i]
      if (analysis) map.set(n.id, normalizeAnalysis(analysis))
    })
  } catch (error) {
    console.error("News analysis failed:", error)
  }

  return map
}

function normalizeAnalysis(raw: Record<string, unknown>): NewsAnalysis {
  return {
    sentiment: (raw.sentiment === "bullish" || raw.sentiment === "bearish"
      ? raw.sentiment
      : "neutral") as NewsSentiment,
    strength: Math.max(0, Math.min(10, Number(raw.strength) || 0)),
    reason: String(raw.reason ?? ""),
    impact: String(raw.impact ?? ""),
    relatedConcepts: Array.isArray(raw.relatedConcepts)
      ? raw.relatedConcepts.map((c) => String(c)).filter(Boolean).slice(0, 3)
      : [],
    tradeHint: String(raw.tradeHint ?? ""),
  }
}

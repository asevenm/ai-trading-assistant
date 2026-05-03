import openai from "@/lib/openai"
import { SHORT_TERM_TRADING_PROMPT } from "./trading-philosophy"
import type { AuctionSummary } from "@/lib/auction-api"

interface AuctionAnalysis {
  sentiment: string
  signals: string[]
  hotThemes: string[]
  watchStocks: { code: string; name: string; reason: string }[]
  strategy: string
  risks: string[]
}

export async function analyzeAuction(
  summary: AuctionSummary
): Promise<AuctionAnalysis> {
  const upRatio =
    summary.total > 0 ? (summary.upCount / summary.total) * 100 : 0
  const totalAmountYi = summary.totalAuctionAmount / 1e8

  const topGainersText = summary.topGainers
    .slice(0, 15)
    .map(
      (s) =>
        `${s.name}(${s.code}) 竞价:+${s.auctionChange.toFixed(2)}% 金额:${(s.auctionAmount / 1e4).toFixed(0)}万`
    )
    .join("\n")

  const yesterdayLimitUpText = summary.yesterdayLimitUp
    .slice(0, 15)
    .map(
      (s) =>
        `${s.name}(${s.code}) 溢价:${s.premium >= 0 ? "+" : ""}${s.premium.toFixed(2)}% [${
          s.status === "limit_up"
            ? "一字"
            : s.status === "high_open"
              ? "高开"
              : s.status === "limit_down"
                ? "跌停"
                : s.status === "low_open"
                  ? "低开"
                  : "平开"
        }]`
    )
    .join("\n")

  const topAmountText = summary.topByAmount
    .slice(0, 10)
    .map(
      (s) =>
        `${s.name}(${s.code}) 竞价金额:${(s.auctionAmount / 1e4).toFixed(0)}万 涨幅:${s.auctionChange.toFixed(2)}%`
    )
    .join("\n")

  const systemPrompt = `${SHORT_TERM_TRADING_PROMPT}

根据集合竞价数据（9:15-9:25），生成开盘前的市场判断和交易策略。

要求:
1. 判断今日开盘情绪（强势高开/分歧/弱势低开），结合高开比例和资金参与度
2. 识别2-3条值得关注的信号（如：昨日涨停一字封板数量、特定板块集体高开）
3. 推荐2-3个早盘可能的热点主题
4. 推荐3-5只竞价信号好的标的（高开+大金额优先；昨日涨停一字也可）
5. 给出具体开盘策略（90字内，包含仓位/操作时机）
6. 列出1-3条风险提示

输出严格JSON:
{
  "sentiment": "开盘情绪判断",
  "signals": ["信号1", "信号2"],
  "hotThemes": ["主题1", "主题2"],
  "watchStocks": [
    { "code": "000001", "name": "股票名", "reason": "竞价表现+逻辑" }
  ],
  "strategy": "开盘策略建议",
  "risks": ["风险1"]
}`

  const userPrompt = `集合竞价数据汇总：

高开/低开/平盘: ${summary.upCount} / ${summary.downCount} / ${summary.flatCount}
高开比例: ${upRatio.toFixed(1)}%
平均竞价涨幅: ${summary.averageChange.toFixed(2)}%
竞价总金额: ${totalAmountYi.toFixed(1)}亿
一字涨停数: ${summary.limitUpCount}
一字跌停数: ${summary.limitDownCount}

跳空缺口分布:
- 高开>5%: ${summary.gapDistribution.gapUp5plus}只
- 高开3-5%: ${summary.gapDistribution.gapUp3to5}只
- 高开1-3%: ${summary.gapDistribution.gapUp1to3}只
- 低开>5%: ${summary.gapDistribution.gapDown5plus}只
- 低开3-5%: ${summary.gapDistribution.gapDown3to5}只

竞价涨幅TOP15:
${topGainersText}

昨日涨停今日竞价表现:
${yesterdayLimitUpText}

竞价金额TOP10:
${topAmountText}`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    })

    const content = response.choices[0].message.content
    if (!content) throw new Error("No AI response")

    return JSON.parse(content)
  } catch (error) {
    console.error("Auction analysis failed:", error)
    return {
      sentiment: "AI 生成失败，请检查 API 配置",
      signals: [],
      hotThemes: [],
      watchStocks: [],
      strategy: "",
      risks: [],
    }
  }
}

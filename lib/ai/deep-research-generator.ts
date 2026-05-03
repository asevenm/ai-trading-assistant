import openai from "@/lib/openai"
import type { KlineItem } from "@/lib/market-api"
import type { FinancialData, StockProfile, ResearchReport } from "@/lib/finance-api"
import { calculateMA, calculateMACD, calculateBoll } from "@/lib/indicators"

interface DeepResearchInput {
  quote: { price: number; changePercent: number; volume: number; turnover: number }
  klines: KlineItem[]
  financial: FinancialData | null
  profile: StockProfile | null
  reports: ResearchReport[]
}

interface DeepResearchOutput {
  fundamentals: string
  technicals: string
  catalysts: string
  risks: string
  valuation: string
  conclusion: string
  rating: string
  targetPrice: number | null
}

function buildTechnicalSummary(klines: KlineItem[]): string {
  if (klines.length < 60) return "K线数据不足，无法进行技术分析"

  const closes = klines.map((k) => k.close)
  const lastIndex = closes.length - 1

  const ma5 = calculateMA(closes, 5)
  const ma10 = calculateMA(closes, 10)
  const ma20 = calculateMA(closes, 20)
  const ma60 = calculateMA(closes, 60)
  const { dif, dea, macd } = calculateMACD(closes)
  const { upper, mid, lower } = calculateBoll(closes)

  const currentPrice = closes[lastIndex]
  const high20 = Math.max(...closes.slice(Math.max(0, lastIndex - 20), lastIndex + 1))
  const low20 = Math.min(...closes.slice(Math.max(0, lastIndex - 20), lastIndex + 1))

  return `当前价: ${currentPrice.toFixed(2)}
均线: MA5=${ma5[lastIndex]?.toFixed(2)} MA10=${ma10[lastIndex]?.toFixed(2)} MA20=${ma20[lastIndex]?.toFixed(2)} MA60=${ma60[lastIndex]?.toFixed(2)}
MACD: DIF=${dif[lastIndex]?.toFixed(3)} DEA=${dea[lastIndex]?.toFixed(3)} MACD柱=${macd[lastIndex]?.toFixed(3)}
布林带: 上轨=${upper[lastIndex]?.toFixed(2)} 中轨=${mid[lastIndex]?.toFixed(2)} 下轨=${lower[lastIndex]?.toFixed(2)}
20日高低: 高点${high20.toFixed(2)} 低点${low20.toFixed(2)}
近5日涨跌: ${klines.slice(-5).map((k) => `${k.changePercent >= 0 ? "+" : ""}${k.changePercent.toFixed(2)}%`).join(", ")}`
}

export async function generateDeepResearch(
  code: string,
  name: string,
  input: DeepResearchInput
): Promise<DeepResearchOutput> {
  const technicalSummary = buildTechnicalSummary(input.klines)

  const financialText = input.financial
    ? `PE: ${input.financial.pe.toFixed(2)}
PB: ${input.financial.pb.toFixed(2)}
ROE: ${input.financial.roe.toFixed(2)}%
营收: ${(input.financial.revenue / 1e8).toFixed(2)}亿
净利润: ${(input.financial.netProfit / 1e8).toFixed(2)}亿
毛利率: ${input.financial.grossMargin.toFixed(2)}%
净利率: ${input.financial.netMargin.toFixed(2)}%
资产负债率: ${input.financial.debtRatio.toFixed(2)}%
总市值: ${(input.financial.totalMarketCap / 1e8).toFixed(2)}亿`
    : "财务数据暂不可用"

  const profileText = input.profile
    ? `行业: ${input.profile.industry}
上市日期: ${input.profile.listDate}
主营业务: ${input.profile.mainBusiness.slice(0, 200)}`
    : "公司概况暂不可用"

  const reportsText =
    input.reports.length > 0
      ? input.reports
          .slice(0, 5)
          .map((r) => `[${r.date}] ${r.orgName} ${r.rating}: ${r.title}`)
          .join("\n")
      : "近期无机构研报"

  const systemPrompt = `你是一位专业的证券分析师，需要为指定股票生成一份结构化的深度调研报告。

报告要求:
1. 基本面分析: 分析公司财务状况、盈利能力、成长性（200字以内）
2. 技术面分析: 分析当前趋势、支撑压力位、量价关系（200字以内）
3. 催化剂: 近期可能的上涨催化因素（100字以内）
4. 风险提示: 主要风险因素（100字以内）
5. 估值分析: 结合PE/PB和行业对比给出估值判断（100字以内）
6. 综合结论: 一句话总结投资建议（50字以内）
7. 评级: "强烈看好" / "看好" / "中性" / "看空" / "强烈看空"
8. 目标价: 基于估值给出的合理目标价（数字，可以为null）

输出严格JSON格式:
{
  "fundamentals": "基本面分析",
  "technicals": "技术面分析",
  "catalysts": "催化剂",
  "risks": "风险提示",
  "valuation": "估值分析",
  "conclusion": "综合结论",
  "rating": "评级",
  "targetPrice": 目标价或null
}`

  const userPrompt = `股票: ${name}(${code})

当前行情:
价格: ${input.quote.price} 涨跌: ${input.quote.changePercent >= 0 ? "+" : ""}${input.quote.changePercent.toFixed(2)}%
成交量: ${input.quote.volume}手 成交额: ${(input.quote.turnover / 1e8).toFixed(2)}亿

技术指标:
${technicalSummary}

财务数据:
${financialText}

公司概况:
${profileText}

机构研报:
${reportsText}`

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
    if (!content) {
      throw new Error("No response from AI")
    }

    return JSON.parse(content)
  } catch (error) {
    console.error("Deep research AI generation failed:", error)
    return {
      fundamentals: "AI 生成失败，请检查 API 配置",
      technicals: "",
      catalysts: "",
      risks: "",
      valuation: "",
      conclusion: "",
      rating: "中性",
      targetPrice: null,
    }
  }
}

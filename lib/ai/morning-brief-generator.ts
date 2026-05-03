import openai from "@/lib/openai"
import { SHORT_TERM_TRADING_PROMPT } from "./trading-philosophy"
import type { LimitUpStock } from "@/lib/limit-up-api"
import type { SectorFlow, StockFlow } from "@/lib/sector-flow-api"

interface MorningBriefInput {
  limitUpStocks: LimitUpStock[]
  bustedCount: number
  bustedRate: number
  sectorInflow: SectorFlow[]
  stockInflow: StockFlow[]
  date: string
}

interface MorningBriefOutput {
  marketSentiment: string // 市场情绪判断
  mainThemes: string[] // 当日主线
  focusStocks: { code: string; name: string; reason: string }[]
  strategy: string // 当日策略建议
  risks: string[] // 风险提示
}

export async function generateMorningBrief(
  input: MorningBriefInput
): Promise<MorningBriefOutput> {
  const limitUpText = input.limitUpStocks
    .slice(0, 30)
    .map((s) => `${s.name}(${s.code}) ${s.industry} 涨幅:${s.changePercent.toFixed(1)}% 换手:${s.turnoverRate.toFixed(1)}%`)
    .join("\n")

  const sectorText = input.sectorInflow
    .slice(0, 15)
    .map((s) => `${s.name} 涨幅:${s.changePercent.toFixed(2)}% 主力净流入:${(s.mainNetInflow / 1e8).toFixed(1)}亿`)
    .join("\n")

  const stockText = input.stockInflow
    .slice(0, 10)
    .map((s) => `${s.name}(${s.code}) 涨幅:${s.changePercent.toFixed(2)}% 主力净流入:${(s.mainNetInflow / 1e8).toFixed(1)}亿`)
    .join("\n")

  const systemPrompt = `${SHORT_TERM_TRADING_PROMPT}

根据昨日涨停数据和资金流向，生成盘前作战计划。

要求:
1. 判断当前市场情绪和风口阶段（初期/中期/末期）
2. 识别2-3条当日交易主线（基于涨停行业分布+资金流向，判断哪些是"刚起风"的新风口）
3. 推荐3-5只重点关注个股（优先推荐风口初期的标的，"要信早信"）
4. 给出具体的当日操作策略（100字以内，包含仓位建议）
5. 列出1-3条风险提示（重点关注炸板率反映的情绪变化）

输出严格JSON格式:
{
  "marketSentiment": "市场情绪判断",
  "mainThemes": ["主线1", "主线2"],
  "focusStocks": [
    { "code": "000001", "name": "平安银行", "reason": "板块龙头+资金持续流入" }
  ],
  "strategy": "操作策略建议",
  "risks": ["风险1", "风险2"]
}`

  const userPrompt = `日期: ${input.date}

昨日涨停统计:
- 涨停数: ${input.limitUpStocks.length}只
- 炸板数: ${input.bustedCount}只
- 炸板率: ${input.bustedRate.toFixed(1)}%

涨停股明细:
${limitUpText}

板块资金流向Top15:
${sectorText}

个股主力资金Top10:
${stockText}`

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
    console.error("Morning brief generation failed:", error)
    return {
      marketSentiment: "AI 生成失败，请检查 API 配置",
      mainThemes: [],
      focusStocks: [],
      strategy: "",
      risks: [],
    }
  }
}

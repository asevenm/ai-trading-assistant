import openai from "@/lib/openai"
import { SECTOR_ROTATION_PROMPT } from "./trading-philosophy"
import type { MarketIndex, SectorData, MarketStats, NorthboundFlow } from "@/lib/market-api"

interface DailyReviewInput {
  indices: MarketIndex[]
  sectors: SectorData[]
  stats: MarketStats
  northbound: NorthboundFlow | null
  date: string
}

interface DailyReviewOutput {
  summary: string
  hotTopics: string[]
  outlook: string
}

export async function generateDailyReview(
  input: DailyReviewInput
): Promise<DailyReviewOutput> {
  const systemPrompt = `你是一位资深的A股短线市场分析师，信奉"追风口"理念。根据提供的当日市场数据，生成简洁精准的每日复盘分析。

${SECTOR_ROTATION_PROMPT}

要求:
1. 总结当日市场整体表现，重点分析当前风口方向和阶段（120字以内）
2. 识别3-5个当日热点主题/板块，标注是新风口还是延续
3. 对次日市场给出简要展望，指出可能的风口切换方向（80字以内）

输出严格JSON格式:
{
  "summary": "当日市场总结",
  "hotTopics": ["热点1", "热点2", "热点3"],
  "outlook": "次日展望"
}`

  const sectorText = input.sectors
    .slice(0, 15)
    .map(
      (s, i) =>
        `${i + 1}. ${s.name} ${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}% 领涨: ${s.leadingStock}`
    )
    .join("\n")

  const indexText = input.indices
    .map(
      (idx) =>
        `${idx.name}: ${idx.price.toFixed(2)} ${idx.changePercent >= 0 ? "+" : ""}${idx.changePercent.toFixed(2)}%`
    )
    .join("\n")

  const northboundText = input.northbound
    ? `沪股通净买入: ${(input.northbound.shNet / 1e8).toFixed(2)}亿  深股通净买入: ${(input.northbound.szNet / 1e8).toFixed(2)}亿  合计: ${(input.northbound.totalNet / 1e8).toFixed(2)}亿`
    : "暂无数据"

  const userPrompt = `日期: ${input.date}

大盘指数:
${indexText}

市场统计:
- 上涨: ${input.stats.upCount}家  下跌: ${input.stats.downCount}家  平盘: ${input.stats.flatCount}家
- 涨停: ${input.stats.limitUpCount}家  跌停: ${input.stats.limitDownCount}家

板块排行（按涨幅）:
${sectorText}

北向资金:
${northboundText}`

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
    console.error("Daily review AI generation failed:", error)
    return {
      summary: "AI 生成失败，请检查 API 配置",
      hotTopics: [],
      outlook: "",
    }
  }
}

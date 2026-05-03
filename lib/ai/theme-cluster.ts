import openai from "@/lib/openai"
import { SHORT_TERM_TRADING_PROMPT } from "./trading-philosophy"
import type { ThemeCluster } from "@/lib/theme-radar-api"

export interface ThemeAnalysis {
  mainline: string // 当前市场主线（一句话）
  coreThemes: {
    name: string
    stage: string // 初期/扩散中/高潮/退潮
    narrative: string // 题材逻辑（为何起风）
    tradeAdvice: string // 操作建议（信/观望/跑）
  }[]
  extensionCandidates: {
    concept: string // 可能被带动的周边概念
    reason: string // 逻辑传导链
    watchStocks: string[] // 建议观察个股（从已有涨停池推断）
  }[]
  riskFlags: string[] // 风险信号（如高度板分歧、炸板率上升）
}

/**
 * 分析题材扩散状态，给出主线判断 + 周边预测
 * 核心价值：
 * 1. 从一堆概念标签里提取真正的"风口叙事"（多个概念聚为一个主题）
 * 2. 预测下一波可能被带动的周边概念（"大胆假设"）
 * 3. 判断当前处于风口哪个阶段（"要信早信"的前提）
 */
export async function analyzeThemeExpansion(
  themes: ThemeCluster[]
): Promise<ThemeAnalysis> {
  const top = themes.slice(0, 12)

  if (top.length === 0) {
    return {
      mainline: "今日涨停数据不足，无法识别主线",
      coreThemes: [],
      extensionCandidates: [],
      riskFlags: [],
    }
  }

  const themeText = top
    .map((t) => {
      const leaders = t.tiers.leader.map((s) => `${s.name}(${s.consecutiveBoards}板)`).join("/")
      const high = t.tiers.highLevel.slice(0, 3).map((s) => `${s.name}(${s.consecutiveBoards}板)`).join("/")
      const inflow = t.mainNetInflow ? `${(t.mainNetInflow / 1e8).toFixed(1)}亿` : "-"
      return `[${t.name}] 涨停${t.limitUpCount}只 最高${t.maxConsecutive}板 龙头:${leaders || "-"} 高度:${high || "-"} 板块净流入:${inflow} 炸板率:${t.bustRate.toFixed(0)}% 阶段:${t.stage} 热度:${t.strength}`
    })
    .join("\n")

  const systemPrompt = `${SHORT_TERM_TRADING_PROMPT}

你是题材扩散雷达分析师。用户给你今日涨停股按概念聚类的数据，你要做3件事：

1. **提取市场主线**（最重要）
   - 多个概念可能只是同一个"风口"的不同说法/子分支
   - 例如"算力+液冷+光模块"其实都是"AI基础设施"主线
   - 例如"机器人+人形机器人+减速器"都是"具身智能"主线
   - 必须穿透概念标签，识别背后的核心叙事

2. **为每个核心主题判断阶段**
   - 初期：龙头刚出现，高度板≤2，跟风股少 → 建议"要信早信"介入
   - 扩散中：梯队完整，2-3板跟风，资金持续流入 → 龙头不破就跟
   - 高潮：4板+龙头分歧，跟风股大量炸板 → 警惕情绪转折
   - 退潮：炸板率>40%，主力净流出 → 果断离场

3. **预测扩散方向**（"大胆假设"）
   - 从主线逻辑推演还有哪些没被市场充分定价的周边概念
   - 例如 AI 基础设施爆炒后可能轮到 "AI 应用落地"、"AI+医疗"、"数据要素"
   - 从已给的涨停池里找那些1-2板的"潜在跟风票"，推荐作为 watch stocks

输出严格 JSON:
{
  "mainline": "一句话主线判断（20字内）",
  "coreThemes": [
    { "name": "主题名（不超过8字）", "stage": "阶段", "narrative": "题材逻辑（40字内）", "tradeAdvice": "操作建议（30字内）" }
  ],
  "extensionCandidates": [
    { "concept": "周边概念", "reason": "逻辑传导链（30字内）", "watchStocks": ["股票名"] }
  ],
  "riskFlags": ["风险信号"]
}`

  const userPrompt = `今日聚类后的Top主题数据：
${themeText}

请输出分析。`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    })

    const content = response.choices[0].message.content
    if (!content) throw new Error("No AI response")

    return JSON.parse(content) as ThemeAnalysis
  } catch (error) {
    console.error("Theme expansion analysis failed:", error)
    return {
      mainline: "AI 分析失败",
      coreThemes: [],
      extensionCandidates: [],
      riskFlags: [`AI 调用失败: ${error instanceof Error ? error.message : "未知错误"}`],
    }
  }
}

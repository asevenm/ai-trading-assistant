import openai from "@/lib/openai"
import type { KlineItem } from "@/lib/market-api"
import {
  calculateMA,
  calculateMACD,
  isMaBullish,
  isMacdGoldenCross,
  isVolumeBreakout,
  isNewHigh,
  isDragonPullback,
  isBottomReversal,
  isPlatformBreakout,
  isLowVolumePullback,
} from "@/lib/indicators"

export interface ScreenStrategy {
  id: string
  name: string
  description: string
}

export interface ScreenMatch {
  code: string
  name: string
  price: number
  changePercent: number
  reason: string
  indicators: Record<string, number | string>
}

export const STRATEGIES: ScreenStrategy[] = [
  {
    id: "ma_bullish",
    name: "均线多头",
    description: "MA5 > MA10 > MA20 > MA60，多头排列趋势向上",
  },
  {
    id: "volume_breakout",
    name: "放量突破",
    description: "成交量放大1.5倍以上，收盘价创20日新高",
  },
  {
    id: "macd_golden",
    name: "MACD金叉",
    description: "DIF上穿DEA，形成金叉买入信号",
  },
  {
    id: "dragon_pullback",
    name: "龙回头",
    description: "强势股回调到MA10/MA20支撑，等待二次启动",
  },
  {
    id: "bottom_reversal",
    name: "底部反转",
    description: "长期下跌后首次放量阳线，底部反转信号",
  },
  {
    id: "platform_breakout",
    name: "突破平台",
    description: "横盘≥10日后放量突破前高，平台突破",
  },
  {
    id: "low_volume_pullback",
    name: "缩量回踩",
    description: "上涨趋势中缩量回踩均线，洗盘结束信号",
  },
]

export function screenByStrategy(
  klines: KlineItem[],
  strategy: string
): { matched: boolean; reason: string; indicators: Record<string, number | string> } {
  if (klines.length < 60) {
    return { matched: false, reason: "数据不足", indicators: {} }
  }

  const closes = klines.map((k) => k.close)
  const opens = klines.map((k) => k.open)
  const highs = klines.map((k) => k.high)
  const volumes = klines.map((k) => k.volume)
  const lastIndex = closes.length - 1

  switch (strategy) {
    case "ma_bullish": {
      const ma5 = calculateMA(closes, 5)
      const ma10 = calculateMA(closes, 10)
      const ma20 = calculateMA(closes, 20)
      const ma60 = calculateMA(closes, 60)

      const matched = isMaBullish(
        ma5[lastIndex],
        ma10[lastIndex],
        ma20[lastIndex],
        ma60[lastIndex]
      )

      return {
        matched,
        reason: matched
          ? `MA5(${ma5[lastIndex].toFixed(2)}) > MA10(${ma10[lastIndex].toFixed(2)}) > MA20(${ma20[lastIndex].toFixed(2)}) > MA60(${ma60[lastIndex].toFixed(2)})`
          : "均线未形成多头排列",
        indicators: {
          MA5: ma5[lastIndex]?.toFixed(2) ?? "N/A",
          MA10: ma10[lastIndex]?.toFixed(2) ?? "N/A",
          MA20: ma20[lastIndex]?.toFixed(2) ?? "N/A",
          MA60: ma60[lastIndex]?.toFixed(2) ?? "N/A",
        },
      }
    }

    case "volume_breakout": {
      const volBreak = isVolumeBreakout(volumes, lastIndex, 5, 1.5)
      const priceHigh = isNewHigh(closes, lastIndex, 20)
      const matched = volBreak && priceHigh

      const avgVol5 =
        volumes.slice(lastIndex - 5, lastIndex).reduce((a, b) => a + b, 0) / 5
      const volRatio = volumes[lastIndex] / avgVol5

      return {
        matched,
        reason: matched
          ? `放量${volRatio.toFixed(1)}倍，创20日新高 ${closes[lastIndex].toFixed(2)}`
          : volBreak
            ? "放量但未创新高"
            : "成交量未有效放大",
        indicators: {
          volume: volumes[lastIndex],
          avgVolume5: Math.round(avgVol5),
          volumeRatio: volRatio.toFixed(2),
          price: closes[lastIndex],
          high20: Math.max(...closes.slice(lastIndex - 20, lastIndex)).toFixed(2),
        },
      }
    }

    case "macd_golden": {
      const { dif, dea, macd } = calculateMACD(closes)
      const matched = isMacdGoldenCross(dif, dea, lastIndex)

      return {
        matched,
        reason: matched
          ? `MACD金叉: DIF(${dif[lastIndex].toFixed(3)}) 上穿 DEA(${dea[lastIndex].toFixed(3)})`
          : "未形成MACD金叉",
        indicators: {
          DIF: dif[lastIndex]?.toFixed(3) ?? "N/A",
          DEA: dea[lastIndex]?.toFixed(3) ?? "N/A",
          MACD: macd[lastIndex]?.toFixed(3) ?? "N/A",
        },
      }
    }

    case "dragon_pullback": {
      const result = isDragonPullback(closes, highs, volumes, lastIndex)
      const ma10 = calculateMA(closes, 10)
      const ma20 = calculateMA(closes, 20)

      return {
        matched: result.matched,
        reason: result.matched
          ? `龙回头: 回调${result.pullbackDays}天至${result.supportMA}支撑，等待反弹`
          : "未满足龙回头条件",
        indicators: {
          price: closes[lastIndex].toFixed(2),
          MA10: ma10[lastIndex]?.toFixed(2) ?? "N/A",
          MA20: ma20[lastIndex]?.toFixed(2) ?? "N/A",
          pullbackDays: result.pullbackDays,
          supportMA: result.supportMA || "N/A",
        },
      }
    }

    case "bottom_reversal": {
      const result = isBottomReversal(closes, opens, volumes, lastIndex)

      return {
        matched: result.matched,
        reason: result.matched
          ? `底部反转: 前期下跌${result.downDays}天，今日放量${result.volumeRatio.toFixed(1)}倍阳线`
          : "未满足底部反转条件",
        indicators: {
          price: closes[lastIndex].toFixed(2),
          change: ((closes[lastIndex] - closes[lastIndex - 1]) / closes[lastIndex - 1] * 100).toFixed(2) + "%",
          volumeRatio: result.volumeRatio.toFixed(2),
          downDays: result.downDays,
        },
      }
    }

    case "platform_breakout": {
      const result = isPlatformBreakout(closes, highs, volumes, lastIndex)

      return {
        matched: result.matched,
        reason: result.matched
          ? `突破平台: 突破前高${result.platformHigh.toFixed(2)}，放量${result.breakoutVolRatio.toFixed(1)}倍`
          : "未满足突破平台条件",
        indicators: {
          price: closes[lastIndex].toFixed(2),
          platformHigh: result.platformHigh.toFixed(2),
          volumeRatio: result.breakoutVolRatio.toFixed(2),
        },
      }
    }

    case "low_volume_pullback": {
      const result = isLowVolumePullback(closes, volumes, lastIndex)
      const ma5 = calculateMA(closes, 5)
      const ma10 = calculateMA(closes, 10)
      const ma20 = calculateMA(closes, 20)

      return {
        matched: result.matched,
        reason: result.matched
          ? `缩量回踩: 回踩${result.supportMA}，量比仅${result.volumeShrink.toFixed(2)}，缩量明显`
          : "未满足缩量回踩条件",
        indicators: {
          price: closes[lastIndex].toFixed(2),
          MA5: ma5[lastIndex]?.toFixed(2) ?? "N/A",
          MA10: ma10[lastIndex]?.toFixed(2) ?? "N/A",
          MA20: ma20[lastIndex]?.toFixed(2) ?? "N/A",
          volumeShrink: result.volumeShrink.toFixed(2),
          supportMA: result.supportMA || "N/A",
        },
      }
    }

    default:
      return { matched: false, reason: "未知策略", indicators: {} }
  }
}

export async function aiScoreScreenResults(
  results: ScreenMatch[]
): Promise<ScreenMatch[]> {
  if (results.length === 0) return []

  const systemPrompt = `你是一位短线量化分析师，信奉"追风口"理念。根据选股结果，对每只股票打分(0-100)。

核心评分逻辑:
1. 是否处于当前市场风口板块（权重最高）— 风口中的票优先
2. 技术形态是否标准 — 均线/MACD/量价配合
3. 处于风口的哪个阶段 — 初期(加分) > 中期(正常) > 末期(减分)
4. 涨幅是否合理 — "要信早信"，初期涨幅不大的优先；已大涨的警惕追高
5. 换手率和成交量 — 量能配合度

评分指导:
- 80-100: 风口初期 + 技术形态好 + 涨幅不大，强烈关注
- 60-79: 技术形态好但风口不够明确，或已有一定涨幅
- 40-59: 普通技术信号，无明显风口加持
- 0-39: 风口末期或追高风险大

输出严格JSON格式:
{
  "scores": [
    { "code": "股票代码", "score": 85, "comment": "一句话点评" }
  ]
}`

  const userPrompt = results
    .map(
      (r) =>
        `${r.name}(${r.code}): 价格${r.price} 涨幅${r.changePercent.toFixed(2)}% 信号:${r.reason}`
    )
    .join("\n")

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
    if (!content) return results

    const parsed = JSON.parse(content)
    const scoreMap = new Map<string, { score: number; comment: string }>()
    parsed.scores?.forEach(
      (s: { code: string; score: number; comment: string }) => {
        scoreMap.set(s.code, { score: s.score, comment: s.comment })
      }
    )

    return results.map((r) => {
      const scoreData = scoreMap.get(r.code)
      return {
        ...r,
        indicators: {
          ...r.indicators,
          aiScore: scoreData?.score ?? 0,
          aiComment: scoreData?.comment ?? "",
        },
      }
    })
  } catch (error) {
    console.error("AI scoring failed:", error)
    return results
  }
}

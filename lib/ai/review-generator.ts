import openai from "@/lib/openai";
import { TradeLog, TradePlan, Stock } from "@prisma/client";

type LogWithRelations = TradeLog & {
  tradePlan: TradePlan & { stock: Stock };
};

interface TradeStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  totalPnL: number;
  maxDrawdown: number;
  tradesByReason: Record<string, { count: number; winRate: number; totalPnL: number }>;
}

export function calculateTradeStats(logs: LogWithRelations[]): TradeStats {
  const sellLogs = logs.filter((l) => l.type === "sell");
  const winCount = sellLogs.filter((l) => l.resultTag === "success").length;
  const lossCount = sellLogs.filter((l) => l.resultTag === "failure").length;
  const totalPnL = logs.reduce((sum, l) => sum + (l.realizedPnL || 0), 0);

  // Calculate by entry reason
  const buyLogs = logs.filter((l) => l.type === "buy");
  const reasonStats: Record<string, { count: number; wins: number; pnl: number }> = {};

  buyLogs.forEach((log) => {
    const reason = log.entryReason || "未分类";
    if (!reasonStats[reason]) {
      reasonStats[reason] = { count: 0, wins: 0, pnl: 0 };
    }
    reasonStats[reason].count++;
  });

  sellLogs.forEach((log) => {
    const planId = log.tradePlanId;
    const relatedBuy = buyLogs.find((b) => b.tradePlanId === planId);
    const reason = relatedBuy?.entryReason || "未分类";

    if (reasonStats[reason]) {
      if (log.resultTag === "success") reasonStats[reason].wins++;
      reasonStats[reason].pnl += log.realizedPnL || 0;
    }
  });

  const tradesByReason: Record<string, { count: number; winRate: number; totalPnL: number }> = {};
  Object.entries(reasonStats).forEach(([reason, stats]) => {
    tradesByReason[reason] = {
      count: stats.count,
      winRate: stats.count > 0 ? stats.wins / stats.count : 0,
      totalPnL: stats.pnl,
    };
  });

  // Calculate max drawdown (simplified)
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;

  logs
    .sort((a, b) => new Date(a.tradeTime).getTime() - new Date(b.tradeTime).getTime())
    .forEach((log) => {
      cumulative += log.realizedPnL || 0;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

  return {
    totalTrades: logs.length,
    winCount,
    lossCount,
    totalPnL,
    maxDrawdown,
    tradesByReason,
  };
}

export async function generateWeeklyReview(
  stats: TradeStats,
  logs: LogWithRelations[]
): Promise<{ summary: string; analysis: string; improvements: string[] }> {
  const sellLogs = logs.filter((l) => l.type === "sell");
  const winRate = stats.totalTrades > 0 ? (stats.winCount / sellLogs.length) * 100 : 0;

  const systemPrompt = `你是一位经验丰富的交易导师。根据交易者本周的交易数据，生成周复盘报告。

要求:
1. 客观分析交易表现
2. 识别交易模式中的问题
3. 提供3条具体可执行的改进建议

输出格式为JSON:
{
  "summary": "本周交易表现总结（100字以内）",
  "analysis": "详细分析（200字以内，包含对不同入场理由的分析）",
  "improvements": ["建议1", "建议2", "建议3"]
}`;

  const userPrompt = `本周交易统计:
- 总交易次数: ${stats.totalTrades}
- 卖出次数: ${sellLogs.length}
- 胜率: ${winRate.toFixed(1)}%
- 总盈亏: ${stats.totalPnL.toFixed(2)}
- 最大回撤: ${stats.maxDrawdown.toFixed(2)}

按入场理由分类:
${Object.entries(stats.tradesByReason)
  .map(
    ([reason, data]) =>
      `- ${reason}: ${data.count}次, 胜率${(data.winRate * 100).toFixed(1)}%, 盈亏${data.totalPnL.toFixed(2)}`
  )
  .join("\n")}

交易明细:
${logs
  .slice(0, 20)
  .map(
    (log) =>
      `${new Date(log.tradeTime).toLocaleDateString()}: ${log.type === "buy" ? "买入" : "卖出"} ${log.tradePlan.stock.name} ${log.quantity}股 @ ${log.price}, 盈亏: ${log.realizedPnL || 0}, 理由: ${log.entryReason || log.exitReason || "无"}`
  )
  .join("\n")}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("AI generation failed:", error);
    return {
      summary: "AI 生成失败，请检查 API 配置",
      analysis: "",
      improvements: [],
    };
  }
}

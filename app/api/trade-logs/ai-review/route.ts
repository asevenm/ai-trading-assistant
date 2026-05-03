import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import openai from "@/lib/openai"
import dayjs from "dayjs"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tradeLogId } = await request.json()

  if (!tradeLogId) {
    return NextResponse.json({ error: "缺少交易记录ID" }, { status: 400 })
  }

  // Get the sell log with its plan and buy log
  const sellLog = await prisma.tradeLog.findUnique({
    where: { id: tradeLogId, userId: session.user.id },
    include: { tradePlan: { include: { stock: true } } },
  })

  if (!sellLog) {
    return NextResponse.json({ error: "交易记录不存在" }, { status: 404 })
  }

  // Get all logs for this plan
  const planLogs = await prisma.tradeLog.findMany({
    where: { tradePlanId: sellLog.tradePlanId },
    orderBy: { tradeTime: "asc" },
  })

  const buyLogs = planLogs.filter((l) => l.type === "buy")
  const sellLogs = planLogs.filter((l) => l.type === "sell")

  const tradeContext = {
    stock: `${sellLog.tradePlan.stock.name}(${sellLog.tradePlan.stock.code})`,
    plan: {
      entryConditions: sellLog.tradePlan.entryConditions,
      stopLoss: sellLog.tradePlan.stopLoss,
      takeProfit: sellLog.tradePlan.takeProfit,
      disproofConditions: sellLog.tradePlan.disproofConditions,
    },
    buys: buyLogs.map((l) => ({
      time: dayjs(l.tradeTime).format("YYYY-MM-DD HH:mm"),
      price: l.price,
      quantity: l.quantity,
      reason: l.entryReason,
    })),
    sells: sellLogs.map((l) => ({
      time: dayjs(l.tradeTime).format("YYYY-MM-DD HH:mm"),
      price: l.price,
      quantity: l.quantity,
      reason: l.exitReason,
      pnl: l.realizedPnL,
      result: l.resultTag,
    })),
  }

  const systemPrompt = `你是一位短线交易教练，信奉"追风口、要信早信、大胆假设小心求证"的理念。
请对以下交易进行复盘分析。

分析要点：
1. 买入时机是否合理（是否在风口早期介入）
2. 仓位控制是否合理
3. 卖出时机是否合理（止盈/止损执行力）
4. 交易计划执行程度（是否按计划操作）
5. 改进建议（具体可操作的建议）

输出JSON格式：
{
  "entryAnalysis": "买入分析",
  "exitAnalysis": "卖出分析",
  "planExecution": "计划执行评估",
  "score": 0-100,
  "improvements": ["改进建议1", "改进建议2"],
  "summary": "一句话总结"
}`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(tradeContext, null, 2) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    })

    const content = response.choices[0].message.content
    if (!content) {
      return NextResponse.json({ error: "AI分析失败" }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(content))
  } catch (error) {
    console.error("AI review failed:", error)
    return NextResponse.json({ error: "AI分析失败" }, { status: 500 })
  }
}

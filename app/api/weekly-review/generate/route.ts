import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateTradeStats, generateWeeklyReview } from "@/lib/ai/review-generator";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekStart: weekStartStr } = await request.json();

  // Default to current week if not specified
  const weekStart = weekStartStr
    ? dayjs(weekStartStr).startOf("isoWeek")
    : dayjs().startOf("isoWeek");
  const weekEnd = weekStart.endOf("isoWeek");

  // Check if review already exists
  const existing = await prisma.weeklyReview.findUnique({
    where: {
      userId_weekStart: {
        userId: session.user.id,
        weekStart: weekStart.toDate(),
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "本周复盘已存在" }, { status: 400 });
  }

  // Get trade logs for the week
  const logs = await prisma.tradeLog.findMany({
    where: {
      userId: session.user.id,
      tradeTime: {
        gte: weekStart.toDate(),
        lte: weekEnd.toDate(),
      },
    },
    include: {
      tradePlan: {
        include: { stock: true },
      },
    },
    orderBy: { tradeTime: "asc" },
  });

  if (logs.length === 0) {
    return NextResponse.json({ error: "本周暂无交易记录" }, { status: 400 });
  }

  // Calculate stats
  const stats = calculateTradeStats(logs);
  const sellLogs = logs.filter((l) => l.type === "sell");
  const winRate = sellLogs.length > 0 ? (stats.winCount / sellLogs.length) * 100 : 0;

  // Generate AI review
  const aiReview = await generateWeeklyReview(stats, logs);

  // Save review
  const review = await prisma.weeklyReview.create({
    data: {
      weekStart: weekStart.toDate(),
      weekEnd: weekEnd.toDate(),
      totalTrades: stats.totalTrades,
      winRate,
      totalPnL: stats.totalPnL,
      maxDrawdown: stats.maxDrawdown,
      summary: aiReview.summary,
      statsByReason: JSON.stringify(stats.tradesByReason),
      improvements: JSON.stringify(aiReview.improvements),
      userId: session.user.id,
    },
  });

  return NextResponse.json({
    ...review,
    analysis: aiReview.analysis,
  });
}

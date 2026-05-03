import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const tradePlanId = searchParams.get("tradePlanId");
  const weekStart = searchParams.get("weekStart");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (tradePlanId) where.tradePlanId = tradePlanId;
  if (weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    where.tradeTime = { gte: start, lt: end };
  }

  const logs = await prisma.tradeLog.findMany({
    where,
    include: {
      tradePlan: {
        include: { stock: true },
      },
    },
    orderBy: { tradeTime: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await request.json();

  if (!data.tradePlanId || !data.type || !data.quantity || !data.price) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }

  const plan = await prisma.tradePlan.findUnique({
    where: { id: data.tradePlanId, userId: session.user.id },
  });

  if (!plan) {
    return NextResponse.json({ error: "交易计划不存在" }, { status: 400 });
  }

  const log = await prisma.tradeLog.create({
    data: {
      tradePlanId: data.tradePlanId,
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      amount: data.quantity * data.price,
      realizedPnL: data.realizedPnL,
      entryReason: data.entryReason,
      exitReason: data.exitReason,
      resultTag: data.resultTag,
      notes: data.notes,
      tradeTime: data.tradeTime ? new Date(data.tradeTime) : new Date(),
      userId: session.user.id,
    },
    include: {
      tradePlan: { include: { stock: true } },
    },
  });

  return NextResponse.json(log);
}

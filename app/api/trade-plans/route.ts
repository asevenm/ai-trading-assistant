import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const stockId = searchParams.get("stockId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (stockId) where.stockId = stockId;
  if (status) where.status = status;

  const plans = await prisma.tradePlan.findMany({
    where,
    include: {
      stock: true,
      tradeLogs: {
        orderBy: { tradeTime: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(plans);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await request.json();

  if (!data.stockId || !data.entryConditions || data.stopLoss === undefined || data.maxPosition === undefined) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }

  const plan = await prisma.tradePlan.create({
    data: {
      stockId: data.stockId,
      entryConditions: data.entryConditions,
      entryPriceMin: data.entryPriceMin,
      entryPriceMax: data.entryPriceMax,
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit,
      maxPosition: data.maxPosition,
      disproofConditions: data.disproofConditions,
      userId: session.user.id,
    },
    include: { stock: true },
  });

  return NextResponse.json(plan);
}

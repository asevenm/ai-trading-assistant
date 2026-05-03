import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isHKCode } from "@/lib/stock-api";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stocks = await prisma.stock.findMany({
    where: { userId: session.user.id },
    include: {
      group: true,
      events: {
        where: {
          eventDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        orderBy: { eventDate: "desc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(stocks);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, name, market, groupId, tags } = await request.json();

  if (!code || !name) {
    return NextResponse.json(
      { error: "股票代码和名称是必填项" },
      { status: 400 }
    );
  }

  const existing = await prisma.stock.findUnique({
    where: {
      userId_code: {
        userId: session.user.id,
        code,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "该股票已在自选列表中" }, { status: 400 });
  }

  const stock = await prisma.stock.create({
    data: {
      code,
      name,
      market: market || (isHKCode(code) ? "HK" : code.startsWith("6") ? "SH" : "SZ"),
      groupId,
      tags: tags ? JSON.stringify(tags) : null,
      userId: session.user.id,
    },
    include: { group: true },
  });

  return NextResponse.json(stock);
}

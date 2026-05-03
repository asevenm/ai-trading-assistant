import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const plan = await prisma.tradePlan.findUnique({
    where: { id, userId: session.user.id },
    include: {
      stock: true,
      tradeLogs: {
        orderBy: { tradeTime: "desc" },
      },
    },
  });

  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(plan);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await request.json();

  const plan = await prisma.tradePlan.update({
    where: { id, userId: session.user.id },
    data: {
      entryConditions: data.entryConditions,
      entryPriceMin: data.entryPriceMin,
      entryPriceMax: data.entryPriceMax,
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit,
      maxPosition: data.maxPosition,
      disproofConditions: data.disproofConditions,
      status: data.status,
    },
    include: { stock: true },
  });

  return NextResponse.json(plan);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.tradePlan.delete({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}

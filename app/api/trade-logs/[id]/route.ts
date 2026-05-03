import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

  const log = await prisma.tradeLog.update({
    where: { id, userId: session.user.id },
    data: {
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      amount: data.quantity * data.price,
      realizedPnL: data.realizedPnL,
      entryReason: data.entryReason,
      exitReason: data.exitReason,
      resultTag: data.resultTag,
      notes: data.notes,
    },
  });

  return NextResponse.json(log);
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

  await prisma.tradeLog.delete({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}

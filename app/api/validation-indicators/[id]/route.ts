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

  const item = await prisma.validationIndicator.update({
    where: { id },
    data: {
      indicator: data.indicator,
      targetValue: data.targetValue,
      currentValue: data.currentValue,
      disproofCondition: data.disproofCondition,
      status: data.status,
    },
  });

  return NextResponse.json(item);
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

  await prisma.validationIndicator.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}

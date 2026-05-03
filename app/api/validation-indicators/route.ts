import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stockId, indicator, targetValue, currentValue, disproofCondition, status } = await request.json();

  if (!stockId || !indicator) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const item = await prisma.validationIndicator.create({
    data: {
      stockId,
      indicator,
      targetValue,
      currentValue,
      disproofCondition,
      status: status || "pending",
    },
  });

  return NextResponse.json(item);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;

  const stock = await prisma.stock.findUnique({
    where: {
      userId_code: {
        userId: session.user.id,
        code,
      },
    },
    include: {
      group: true,
      events: {
        orderBy: { eventDate: "desc" },
        take: 50,
      },
      researchNotes: {
        orderBy: { createdAt: "desc" },
      },
      validationIndicators: true,
      tradePlans: {
        where: { status: "active" },
      },
      deepResearches: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!stock) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  return NextResponse.json(stock);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const data = await request.json();

  const stock = await prisma.stock.update({
    where: {
      userId_code: {
        userId: session.user.id,
        code,
      },
    },
    data: {
      groupId: data.groupId,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      notes: data.notes,
    },
    include: { group: true },
  });

  return NextResponse.json(stock);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;

  await prisma.stock.delete({
    where: {
      userId_code: {
        userId: session.user.id,
        code,
      },
    },
  });

  return NextResponse.json({ success: true });
}

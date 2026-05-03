import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stockId, content, eventId } = await request.json();

  if (!stockId || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const note = await prisma.researchNote.create({
    data: {
      stockId,
      content,
      eventId,
      userId: session.user.id,
    },
  });

  return NextResponse.json(note);
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "30")

  const reviews = await prisma.dailyReview.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: limit,
  })

  return NextResponse.json(reviews)
}

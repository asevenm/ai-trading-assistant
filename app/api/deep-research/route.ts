import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "20")
  const stockCode = searchParams.get("stockCode")

  const where: Record<string, unknown> = { userId: session.user.id }
  if (stockCode) {
    where.stockCode = stockCode
  }

  const researches = await prisma.deepResearch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return NextResponse.json(researches)
}

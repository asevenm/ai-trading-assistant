import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "50")
  const strategy = searchParams.get("strategy")

  const where: Record<string, unknown> = { userId: session.user.id }
  if (strategy) {
    where.strategyName = strategy
  }

  const results = await prisma.screenResult.findMany({
    where,
    orderBy: { matchDate: "desc" },
    take: limit,
  })

  return NextResponse.json(results)
}

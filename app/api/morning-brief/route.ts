import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const briefs = await prisma.morningBrief.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: 10,
  })

  return NextResponse.json(
    briefs.map((b) => ({
      id: b.id,
      date: b.date,
      aiStrategy: b.aiStrategy ? JSON.parse(b.aiStrategy) : null,
      limitUpAnalysis: b.limitUpAnalysis ? JSON.parse(b.limitUpAnalysis) : null,
      focusSectors: b.focusSectors ? JSON.parse(b.focusSectors) : null,
      focusStocks: b.focusStocks ? JSON.parse(b.focusStocks) : null,
    }))
  )
}

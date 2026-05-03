import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let settings = await prisma.riskSettings.findUnique({
    where: { userId: session.user.id },
  })

  if (!settings) {
    settings = await prisma.riskSettings.create({
      data: { userId: session.user.id },
    })
  }

  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await request.json()

  const settings = await prisma.riskSettings.upsert({
    where: { userId: session.user.id },
    update: {
      maxDailyLoss: data.maxDailyLoss,
      maxConsecutiveLoss: data.maxConsecutiveLoss,
      maxSinglePosition: data.maxSinglePosition,
      maxTotalPosition: data.maxTotalPosition,
      totalCapital: data.totalCapital,
    },
    create: {
      userId: session.user.id,
      maxDailyLoss: data.maxDailyLoss ?? 2.0,
      maxConsecutiveLoss: data.maxConsecutiveLoss ?? 3,
      maxSinglePosition: data.maxSinglePosition ?? 20.0,
      maxTotalPosition: data.maxTotalPosition ?? 80.0,
      totalCapital: data.totalCapital ?? 100000,
    },
  })

  return NextResponse.json(settings)
}

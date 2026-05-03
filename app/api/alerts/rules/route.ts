import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { DEFAULT_ALERT_RULES } from "@/lib/alert-scanner"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rules = await prisma.alertRule.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(rules)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const data = await request.json()

  // Initialize default rules
  if (data.initDefaults) {
    const existing = await prisma.alertRule.count({
      where: { userId },
    })

    if (existing === 0) {
      const rules = await prisma.$transaction(
        DEFAULT_ALERT_RULES.map((rule) =>
          prisma.alertRule.create({
            data: {
              name: `${rule.type}_default`,
              type: rule.type,
              threshold: rule.threshold,
              scope: rule.scope,
              enabled: rule.enabled,
              userId,
            },
          })
        )
      )
      return NextResponse.json(rules)
    }

    const rules = await prisma.alertRule.findMany({
      where: { userId },
    })
    return NextResponse.json(rules)
  }

  if (!data.type || data.threshold === undefined) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
  }

  const rule = await prisma.alertRule.create({
    data: {
      name: data.name || data.type,
      type: data.type,
      threshold: data.threshold,
      scope: data.scope || "watchlist",
      stockCodes: data.stockCodes ? JSON.stringify(data.stockCodes) : null,
      enabled: data.enabled ?? true,
      userId: session.user.id,
    },
  })

  return NextResponse.json(rule)
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await request.json()

  if (!data.id) {
    return NextResponse.json({ error: "缺少规则 ID" }, { status: 400 })
  }

  const rule = await prisma.alertRule.update({
    where: { id: data.id, userId: session.user.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.threshold !== undefined && { threshold: data.threshold }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.scope !== undefined && { scope: data.scope }),
      ...(data.stockCodes !== undefined && {
        stockCodes: JSON.stringify(data.stockCodes),
      }),
    },
  })

  return NextResponse.json(rule)
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await request.json()

  await prisma.alertRule.delete({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}

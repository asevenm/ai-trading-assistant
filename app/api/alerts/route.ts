import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const unreadOnly = searchParams.get("unread") === "true"
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  const where: Record<string, unknown> = { userId: session.user.id }
  if (unreadOnly) where.read = false

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.alert.count({ where }),
  ])

  return NextResponse.json({ alerts, total })
}

// Mark alerts as read
export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { ids, readAll } = await request.json()

  if (readAll) {
    await prisma.alert.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })
  } else if (ids?.length) {
    await prisma.alert.updateMany({
      where: { id: { in: ids }, userId: session.user.id },
      data: { read: true },
    })
  }

  return NextResponse.json({ success: true })
}

// Clear old alerts
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get("days") || "7")
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  await prisma.alert.deleteMany({
    where: {
      userId: session.user.id,
      createdAt: { lt: cutoff },
    },
  })

  return NextResponse.json({ success: true })
}

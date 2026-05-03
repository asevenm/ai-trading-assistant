import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import dayjs from "dayjs"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { date: dateStr } = await params
  const date = dayjs(dateStr).startOf("day")

  const review = await prisma.dailyReview.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date: date.toDate(),
      },
    },
  })

  if (!review) {
    return NextResponse.json({ error: "未找到该日期的复盘" }, { status: 404 })
  }

  return NextResponse.json(review)
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBillboardDetail } from "@/lib/billboard-api"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const date = searchParams.get("date") || undefined

  if (!code) {
    return NextResponse.json({ error: "缺少股票代码" }, { status: 400 })
  }

  const detail = await getBillboardDetail(code, date)

  if (!detail) {
    return NextResponse.json({ error: "未找到龙虎榜数据" }, { status: 404 })
  }

  return NextResponse.json(detail)
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { calculateLimitUpOrder } from "@/lib/seal-order-api"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const code = String(body?.code ?? "").trim()
    const fundAmount = Number(body?.fundAmount)

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "股票代码格式错误" }, { status: 400 })
    }
    if (!Number.isFinite(fundAmount) || fundAmount < 1000) {
      return NextResponse.json({ error: "资金金额无效（最低1000元）" }, { status: 400 })
    }

    const result = await calculateLimitUpOrder({ code, fundAmount })
    if (!result) {
      return NextResponse.json(
        { error: "该股票未在今日涨停池，无法计算" },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Calculator failed:", error)
    return NextResponse.json({ error: "计算失败" }, { status: 500 })
  }
}

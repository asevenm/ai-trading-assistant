import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runDnaMatch } from "@/lib/dna-match-api"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const targetCode = String(body?.targetCode ?? "").trim()
    const windowDays = Number(body?.windowDays) || 30
    const futureDays = Number(body?.futureDays) || 10

    if (!/^\d{6}$/.test(targetCode)) {
      return NextResponse.json({ error: "股票代码格式错误" }, { status: 400 })
    }

    if (windowDays < 10 || windowDays > 90) {
      return NextResponse.json({ error: "窗口天数需在10-90之间" }, { status: 400 })
    }

    const result = await runDnaMatch({
      userId: session.user.id,
      targetCode,
      windowDays,
      futureDays,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("DNA match failed:", error)
    return NextResponse.json({ error: "匹配失败" }, { status: 500 })
  }
}

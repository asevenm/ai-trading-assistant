import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isHKCode } from "@/lib/stock-api"

const DORMANT_GROUP_NAME = "蛰伏股池"
const DORMANT_GROUP_COLOR = "#722ed1"
const DORMANT_RULE_PREFIX = "dormant_auto_"

const DORMANT_DEFAULT_RULES = [
  { type: "price_surge", threshold: 5 },
  { type: "near_limit_up", threshold: 2 },
  { type: "volume_surge", threshold: 2.5 },
] as const

interface WatchPayload {
  code: string
  name: string
}

/**
 * GET: 返回当前用户已监控的蛰伏股代码集合
 *      用于前端高亮"已加监控"状态
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const group = await prisma.stockGroup.findUnique({
    where: { userId_name: { userId, name: DORMANT_GROUP_NAME } },
    include: { stocks: { select: { code: true } } },
  })

  const watchedCodes = group?.stocks.map((s) => s.code) ?? []

  return NextResponse.json({ watchedCodes })
}

/**
 * POST: 一键将蛰伏股加入关注池 + 自动创建 3 条专属告警规则
 *
 * - 自动创建/复用 "蛰伏股池" 分组
 * - 写入或更新 Stock 记录，归入该分组
 * - 创建 3 条 scope=custom 的告警规则（涨幅突破 / 逼近涨停 / 放量），与该股绑定
 * - 重复调用幂等：已存在则跳过
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  let payload: WatchPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const code = String(payload.code || "").trim()
  const name = String(payload.name || "").trim()
  if (!/^\d{6}$/.test(code) || !name) {
    return NextResponse.json({ error: "Invalid stock" }, { status: 400 })
  }

  // 1. 找/建蛰伏股池分组
  const group = await prisma.stockGroup.upsert({
    where: { userId_name: { userId, name: DORMANT_GROUP_NAME } },
    update: {},
    create: {
      userId,
      name: DORMANT_GROUP_NAME,
      color: DORMANT_GROUP_COLOR,
      sortOrder: 0,
    },
  })

  // 2. 写入 Stock，已存在则归入分组
  const market = isHKCode(code) ? "HK" : code.startsWith("6") ? "SH" : "SZ"
  const existingStock = await prisma.stock.findUnique({
    where: { userId_code: { userId, code } },
  })

  let stockAdded = false
  if (existingStock) {
    if (existingStock.groupId !== group.id) {
      await prisma.stock.update({
        where: { id: existingStock.id },
        data: { groupId: group.id },
      })
    }
  } else {
    await prisma.stock.create({
      data: {
        code,
        name,
        market,
        groupId: group.id,
        userId,
        tags: JSON.stringify(["蛰伏股"]),
      },
    })
    stockAdded = true
  }

  // 3. 创建 3 条 custom 告警规则（如已存在则跳过）
  const createdRules: { id: string; type: string; threshold: number }[] = []
  for (const def of DORMANT_DEFAULT_RULES) {
    const ruleName = `${DORMANT_RULE_PREFIX}${def.type}_${code}`
    const exists = await prisma.alertRule.findFirst({
      where: { userId, name: ruleName },
    })
    if (exists) continue

    const rule = await prisma.alertRule.create({
      data: {
        name: ruleName,
        type: def.type,
        threshold: def.threshold,
        scope: "custom",
        stockCodes: JSON.stringify([code]),
        enabled: true,
        userId,
      },
    })
    createdRules.push({ id: rule.id, type: rule.type, threshold: rule.threshold })
  }

  return NextResponse.json({
    success: true,
    stockAdded,
    rulesCreated: createdRules.length,
    rules: createdRules,
    groupName: DORMANT_GROUP_NAME,
  })
}

/**
 * DELETE: 移除监控（删除该股票的所有蛰伏告警规则；股票本身保留在关注池）
 */
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const url = new URL(request.url)
  const code = url.searchParams.get("code") || ""
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  const result = await prisma.alertRule.deleteMany({
    where: {
      userId,
      name: { startsWith: DORMANT_RULE_PREFIX },
      stockCodes: { contains: code },
    },
  })

  return NextResponse.json({ success: true, deleted: result.count })
}

/**
 * JSON → Postgres 数据导入脚本
 *
 * 用途：在切换 Prisma provider 到 Postgres、运行 migrate 创建 schema 后，
 *      把 export-sqlite.ts 导出的 JSON 数据灌入新 Postgres 数据库。
 *
 * 运行：DATABASE_URL="postgresql://..." pnpm dlx tsx scripts/migration/import-postgres.ts
 *
 * 注意事项：
 *  1. 表必须按外键依赖顺序导入（已编排好）
 *  2. DateTime 字段需要从 ISO string 转回 Date 对象（用 reviver 自动处理）
 *  3. 保留原始 cuid id，不让 Prisma 重新生成
 *  4. 使用 createMany 批量插入，Postgres 性能高
 */
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs/promises'
import path from 'node:path'

const prisma = new PrismaClient()
const IN_DIR = path.join(process.cwd(), 'tmp', 'migration-data')

// 顺序很重要：父表必须先插入，否则外键约束会报错
const IMPORT_ORDER = [
  'user',
  'account',
  'session',
  'verificationToken',
  'stockGroup',
  'riskSettings',
  'alertRule',
  'stock',
  'event',
  'validationIndicator',
  'tradePlan',
  'researchNote',
  'tradeLog',
  'weeklyReview',
  'dailyReview',
  'screenResult',
  'deepResearch',
  'morningBrief',
  'alert',
  'boardSnapshot',
  'rotationEvent',
] as const

// schema 中所有 DateTime 类型的字段名
// JSON.stringify(Date) 会变成 ISO string，导入时需要还原成 Date 对象
const DATE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'emailVerified',
  'expires',
  'eventDate',
  'tradeTime',
  'weekStart',
  'weekEnd',
  'date',
  'matchDate',
  'timestamp',
])

function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && DATE_FIELDS.has(_key) && value.length >= 10) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
  }
  return value
}

async function loadJson(table: string): Promise<Record<string, unknown>[]> {
  const filepath = path.join(IN_DIR, `${table}.json`)
  const raw = await fs.readFile(filepath, 'utf-8')
  return JSON.parse(raw, reviveDates)
}

async function main() {
  console.log(`📥 导入数据源: ${IN_DIR}\n`)

  // 健康检查 1: 摘要文件存在
  const summaryPath = path.join(IN_DIR, '_summary.json')
  try {
    await fs.access(summaryPath)
  } catch {
    throw new Error(`未找到 _summary.json，请先运行 export-sqlite.ts`)
  }
  const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'))
  console.log(`   源 DB: ${summary.sourceDatabase}`)
  console.log(`   导出时间: ${summary.exportedAt}`)
  console.log(`   预期总行数: ${summary.totalRows}\n`)

  // 健康检查 2: 目标库是空的（避免覆盖现有数据）
  const userCount = await prisma.user.count()
  if (userCount > 0) {
    throw new Error(
      `目标 Postgres 已有 ${userCount} 个用户，拒绝导入以防数据损坏。` +
      `如果确认要重导，先 prisma migrate reset 清空。`,
    )
  }

  let totalImported = 0
  const importedCounts: Record<string, number> = {}

  for (const table of IMPORT_ORDER) {
    let rows: Record<string, unknown>[]
    try {
      rows = await loadJson(table)
    } catch (e) {
      console.log(`  ⊘ ${table.padEnd(22)} (无导出文件，跳过)`)
      continue
    }

    if (rows.length === 0) {
      console.log(`  ○ ${table.padEnd(22)}      0 行 (空表)`)
      continue
    }

    const client = (prisma as unknown as Record<string, {
      createMany: (args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => Promise<{ count: number }>
    }>)[table]

    if (!client) {
      console.warn(`  ⚠️  ${table.padEnd(22)} Prisma client 缺失`)
      continue
    }

    const result = await client.createMany({
      data: rows,
      skipDuplicates: false,
    })

    importedCounts[table] = result.count
    totalImported += result.count
    const expected = summary.counts[table] ?? 0
    const status = result.count === expected ? '✓' : '⚠️'
    console.log(`  ${status} ${table.padEnd(22)} ${String(result.count).padStart(6)} 行 (导出 ${expected})`)
  }

  console.log(`\n✅ 导入完成 - 总计 ${totalImported} 行 (导出 ${summary.totalRows})`)

  if (totalImported !== summary.totalRows) {
    console.error(`\n⚠️  行数不匹配！请人工检查 _summary.json 与导入结果`)
    process.exit(2)
  }
}

main()
  .catch((e) => {
    console.error('\n❌ 导入失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

/**
 * SQLite → JSON 数据导出脚本
 *
 * 用途：在切换 Prisma provider 到 Postgres 之前，把当前 SQLite 数据库
 *      所有表的数据导出到 JSON 文件，供后续 import-postgres.ts 灌入新数据库。
 *
 * 运行：DATABASE_URL="file:./dev.db" pnpm dlx tsx scripts/migration/export-sqlite.ts
 *
 * 输出：tmp/migration-data/<table>.json
 *      tmp/migration-data/_summary.json
 */
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs/promises'
import path from 'node:path'

const prisma = new PrismaClient()

const OUT_DIR = path.join(process.cwd(), 'tmp', 'migration-data')

// 顺序无关紧要（导出阶段），但保持和 import 一致便于对照
const TABLES = [
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

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  console.log(`📦 导出目标目录: ${OUT_DIR}\n`)

  const counts: Record<string, number> = {}

  for (const table of TABLES) {
    const client = (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[table]
    if (!client) {
      console.warn(`  ⚠️  ${table}: Prisma client 未找到该表，跳过`)
      continue
    }

    const rows = await client.findMany()
    const filepath = path.join(OUT_DIR, `${table}.json`)
    await fs.writeFile(filepath, JSON.stringify(rows, null, 2), 'utf-8')

    counts[table] = rows.length
    const sizeKB = (Buffer.byteLength(JSON.stringify(rows), 'utf-8') / 1024).toFixed(1)
    console.log(`  ✓ ${table.padEnd(22)} ${String(rows.length).padStart(6)} 行  (${sizeKB} KB)`)
  }

  const summary = {
    exportedAt: new Date().toISOString(),
    sourceDatabase: process.env.DATABASE_URL || '(未指定)',
    totalRows: Object.values(counts).reduce((a, b) => a + b, 0),
    counts,
  }

  await fs.writeFile(
    path.join(OUT_DIR, '_summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8',
  )

  console.log(`\n✅ 导出完成 - 总计 ${summary.totalRows} 行`)
  console.log(`   摘要: ${path.join(OUT_DIR, '_summary.json')}`)
}

main()
  .catch((e) => {
    console.error('❌ 导出失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

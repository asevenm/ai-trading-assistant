"use client"

import { Card, Tag, Tooltip, Empty, Space } from "antd"
import { CrownOutlined, FireOutlined, ThunderboltOutlined, TeamOutlined } from "@ant-design/icons"
import Link from "next/link"
import type { LimitUpPoolStock } from "@/lib/theme-radar-api"

interface LadderPyramidProps {
  pool: LimitUpPoolStock[]
  onFindCousins?: (stock: { code: string; name: string }) => void
}

interface TierData {
  streak: number
  label: string
  stocks: LimitUpPoolStock[]
  totalSealAmount: number
  bustCount: number
  bgColor: string
  borderColor: string
  glow: boolean
}

const TIER_VISUAL: Record<number, { bg: string; border: string; glow: boolean }> = {
  // 高度板 - 红色高亮 + 发光
  10: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.55)", glow: true },
  9: { bg: "rgba(239,68,68,0.13)", border: "rgba(239,68,68,0.50)", glow: true },
  8: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.45)", glow: true },
  7: { bg: "rgba(239,68,68,0.11)", border: "rgba(239,68,68,0.40)", glow: true },
  6: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.35)", glow: true },
  5: { bg: "rgba(239,68,68,0.09)", border: "rgba(239,68,68,0.30)", glow: false },
  4: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)", glow: false },
  3: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", glow: false },
  2: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", glow: false },
  1: { bg: "rgba(160,160,160,0.06)", border: "rgba(160,160,160,0.18)", glow: false },
}

function streakLabel(streak: number): string {
  if (streak === 1) return "首板"
  if (streak >= 6) return `${streak} 连板 · 高度`
  return `${streak} 连板`
}

function streakIcon(streak: number) {
  if (streak >= 5) return <FireOutlined style={{ color: "#ef4444" }} />
  if (streak >= 3) return <FireOutlined style={{ color: "#f59e0b" }} />
  if (streak >= 2) return <ThunderboltOutlined style={{ color: "#3b82f6" }} />
  return null
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-"
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (value >= 1e4) return `${(value / 1e4).toFixed(0)}万`
  return value.toFixed(0)
}

function buildTiers(pool: LimitUpPoolStock[]): TierData[] {
  const grouped = new Map<number, LimitUpPoolStock[]>()
  for (const stock of pool) {
    const streak = Math.max(1, stock.consecutiveBoards)
    const existing = grouped.get(streak)
    grouped.set(streak, existing ? [...existing, stock] : [stock])
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => b - a)
    .map(([streak, stocks]) => {
      const sortedStocks = [...stocks].sort((a, b) => b.sealAmount - a.sealAmount)
      const visual = TIER_VISUAL[streak] ?? TIER_VISUAL[10]
      return {
        streak,
        label: streakLabel(streak),
        stocks: sortedStocks,
        totalSealAmount: sortedStocks.reduce((sum, s) => sum + (s.sealAmount || 0), 0),
        bustCount: sortedStocks.reduce((sum, s) => sum + (s.bustCount || 0), 0),
        bgColor: visual.bg,
        borderColor: visual.border,
        glow: visual.glow,
      }
    })
}

interface StockChipProps {
  stock: LimitUpPoolStock
  isLeader: boolean
  onFindCousins?: (stock: { code: string; name: string }) => void
}

function StockChip({ stock, isLeader, onFindCousins }: StockChipProps) {
  const danger = stock.bustCount > 0
  const tooltip = (
    <div className="text-xs space-y-0.5">
      <div className="font-medium">
        {stock.name} · {stock.code}
      </div>
      <div>连板：{stock.consecutiveBoards} 板</div>
      <div>封单：¥{formatAmount(stock.sealAmount)}</div>
      <div>换手：{stock.turnoverRate.toFixed(1)}%</div>
      <div>首封：{stock.firstSealTime || "-"}</div>
      {stock.bustCount > 0 && (
        <div className="text-yellow-400">炸板 {stock.bustCount} 次</div>
      )}
      {stock.industry && <div>行业：{stock.industry}</div>}
      {stock.concepts.length > 0 && (
        <div>概念：{stock.concepts.slice(0, 3).join(" / ")}</div>
      )}
      {onFindCousins && (
        <div className="pt-1 mt-1 border-t border-white/15 text-blue-300">
          点击芯片打开个股，或用右侧按钮找兄弟
        </div>
      )}
    </div>
  )

  return (
    <Tooltip title={tooltip} mouseEnterDelay={0.2}>
      <div
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md transition-all hover:scale-105"
        style={{
          backgroundColor: isLeader
            ? "rgba(239,68,68,0.25)"
            : danger
              ? "rgba(245,158,11,0.18)"
              : "rgba(255,255,255,0.06)",
          border: `1px solid ${
            isLeader ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.10)"
          }`,
          boxShadow: isLeader ? "0 0 8px rgba(239,68,68,0.4)" : undefined,
        }}
      >
        {isLeader && <CrownOutlined style={{ color: "#fbbf24", fontSize: 12 }} />}
        <Link
          href={`/stock/${stock.code}`}
          className="text-xs font-medium text-white hover:text-blue-300"
        >
          {stock.name}
        </Link>
        {danger && (
          <span className="text-[10px] text-yellow-400" title="炸过板">
            ×{stock.bustCount}
          </span>
        )}
        {onFindCousins && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              onFindCousins({ code: stock.code, name: stock.name })
            }}
            className="ml-0.5 text-[10px] text-blue-300 hover:text-blue-400"
            title="找兄弟（同概念/同涨停的票）"
          >
            <TeamOutlined />
          </button>
        )}
      </div>
    </Tooltip>
  )
}

interface TierRowProps {
  tier: TierData
  leaderCode: string | null
  onFindCousins?: (stock: { code: string; name: string }) => void
}

function TierRow({ tier, leaderCode, onFindCousins }: TierRowProps) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: tier.bgColor,
        border: `1px solid ${tier.borderColor}`,
        boxShadow: tier.glow ? `0 0 18px -4px ${tier.borderColor}` : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {streakIcon(tier.streak)}
          <span className="text-sm font-semibold">{tier.label}</span>
          <Tag color={tier.streak >= 5 ? "red" : tier.streak >= 3 ? "orange" : "blue"} variant="filled">
            {tier.stocks.length} 只
          </Tag>
        </div>
        <Space size="middle" className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span>合计封单 ¥{formatAmount(tier.totalSealAmount)}</span>
          {tier.bustCount > 0 && (
            <span style={{ color: "#fbbf24" }}>本档炸板 {tier.bustCount} 次</span>
          )}
        </Space>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tier.stocks.map((stock) => (
          <StockChip
            key={stock.code}
            stock={stock}
            isLeader={stock.code === leaderCode}
            onFindCousins={onFindCousins}
          />
        ))}
      </div>
    </div>
  )
}

export function LadderPyramid({ pool, onFindCousins }: LadderPyramidProps) {
  if (!pool || pool.length === 0) {
    return (
      <Card title="连板梯队" variant="borderless" className="mb-6">
        <Empty description="暂无涨停池数据" />
      </Card>
    )
  }

  const tiers = buildTiers(pool)
  const maxStreak = tiers[0]?.streak ?? 1
  // 龙头 = 最高连板里封单最大的那只
  const leaderCode = tiers[0]?.stocks[0]?.code ?? null

  const totalSeal = pool.reduce((sum, s) => sum + (s.sealAmount || 0), 0)
  const totalBust = pool.reduce((sum, s) => sum + (s.bustCount || 0), 0)
  const highTierCount = pool.filter((s) => s.consecutiveBoards >= 3).length

  return (
    <Card
      title={
        <div className="flex items-center gap-3 flex-wrap">
          <span>连板梯队</span>
          <Tag color="red" variant="filled">高度 {maxStreak} 板</Tag>
          <Tag color="orange">≥3 连：{highTierCount} 只</Tag>
          <Tag color="default">总封单 ¥{formatAmount(totalSeal)}</Tag>
          {totalBust > 0 && (
            <Tag color="warning">总炸板 {totalBust} 次</Tag>
          )}
        </div>
      }
      variant="borderless"
      className="mb-6"
    >
      <div className="flex flex-col gap-2">
        {tiers.map((tier) => (
          <TierRow
            key={tier.streak}
            tier={tier}
            leaderCode={tier.streak === maxStreak ? leaderCode : null}
            onFindCousins={onFindCousins}
          />
        ))}
      </div>
      <div className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <CrownOutlined style={{ color: "#fbbf24" }} /> = 龙头（最高连板 + 封单第一） ·
        chip 内 ×N = 当日炸板次数 · 点击股票名进个股，团队图标找兄弟
      </div>
    </Card>
  )
}
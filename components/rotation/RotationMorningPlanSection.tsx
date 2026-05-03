"use client"

import { useEffect, useState } from "react"
import { Card, Empty, Spin, Tag } from "antd"
import { ArrowDownOutlined, ArrowUpOutlined, WarningOutlined } from "@ant-design/icons"
import Link from "next/link"

interface MorningPlanResponse {
  prevTradeDate: string | null
  tailContinuity: {
    boardId: string
    boardName: string
    score1430: number
    scoreClose: number
    delta: number
    stage: string | null
  }[]
  relayCandidates: {
    boardId: string
    boardName: string
    closeScore: number
    stage: string | null
    leaderStocks: string[]
    limitUpCount: number
    topStreak: number
  }[]
  riskWarnings: {
    boardId: string
    boardName: string
    closeScore: number
    stage: string | null
    reason: string | null
    leaderStocks: string[]
  }[]
}

const STAGE_TAG: Record<string, { color: string; label: string }> = {
  STARTING: { color: "green", label: "🟢启动" },
  RISING: { color: "red", label: "🔥主升" },
  DIVERGING: { color: "orange", label: "⚠️分歧" },
  FADING: { color: "default", label: "🔻退潮" },
}

export function RotationMorningPlanSection({
  boardType = "CONCEPT",
}: {
  boardType?: "INDUSTRY" | "CONCEPT"
}) {
  const [data, setData] = useState<MorningPlanResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/rotation/morning-plan?boardType=${boardType}`, {
          cache: "no-store",
        })
        if (!res.ok) throw new Error("Failed")
        const json = (await res.json()) as MorningPlanResponse
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [boardType])

  if (loading) {
    return (
      <Card variant="borderless" className="mt-4">
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      </Card>
    )
  }

  if (!data || !data.prevTradeDate) {
    return (
      <Card variant="borderless" className="mt-4" title="今日轮动预判">
        <Empty description="暂无昨日快照数据。请先在题材雷达页面累积昨日的快照（特别是 1430 和 CLOSE）。" />
      </Card>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <Card variant="borderless" title={`🎯 接力候选（基于 ${data.prevTradeDate} 收盘）`}>
        {data.relayCandidates.length === 0 ? (
          <Empty description="昨日无 STARTING / RISING 阶段板块" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.relayCandidates.map((c) => (
              <div key={c.boardId} className="border border-border rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Link href={`/sector/${c.boardId}`} className="font-semibold">
                    {c.boardName}
                  </Link>
                  {c.stage && (
                    <Tag color={STAGE_TAG[c.stage]?.color} variant="filled" className="!m-0">
                      {STAGE_TAG[c.stage]?.label}
                    </Tag>
                  )}
                </div>
                <div className="text-xs text-muted">
                  收盘 S={c.closeScore.toFixed(1)} · 涨停 {c.limitUpCount} · 最高 {c.topStreak} 板
                </div>
                {c.leaderStocks.length > 0 && (
                  <div className="text-xs mt-1">
                    龙头：
                    {c.leaderStocks.map((code) => (
                      <Link key={code} href={`/stock/${code}`}>
                        <Tag className="!m-0 ml-1 cursor-pointer">{code}</Tag>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        variant="borderless"
        title={
          <span>
            <WarningOutlined className="text-down" /> 风险预警（昨日分歧高位板块）
          </span>
        }
      >
        {data.riskWarnings.length === 0 ? (
          <Empty description="昨日无 S≥70 且分歧的板块" />
        ) : (
          <div className="space-y-2">
            {data.riskWarnings.map((r) => (
              <div key={r.boardId} className="flex items-center gap-2 text-sm border-b border-border pb-2">
                <Link href={`/sector/${r.boardId}`} className="font-semibold">
                  {r.boardName}
                </Link>
                <Tag color="orange" variant="filled" className="!m-0">
                  S={r.closeScore.toFixed(1)}
                </Tag>
                <span className="text-xs text-muted">{r.reason ?? ""}</span>
                {r.leaderStocks.length > 0 && (
                  <span className="text-xs ml-auto">
                    龙头：
                    {r.leaderStocks.map((code) => (
                      <Link key={code} href={`/stock/${code}`}>
                        <Tag className="!m-0 ml-1 cursor-pointer">{code}</Tag>
                      </Link>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card variant="borderless" title="📈 昨日尾盘强度延续度（14:30 → CLOSE）">
        {data.tailContinuity.length === 0 ? (
          <Empty description="缺少 14:30 或 CLOSE 快照" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.tailContinuity.map((t) => (
              <div
                key={t.boardId}
                className="flex items-center justify-between text-sm border-b border-border pb-1"
              >
                <Link href={`/sector/${t.boardId}`} className="font-medium">
                  {t.boardName}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">
                    {t.score1430.toFixed(0)} → {t.scoreClose.toFixed(0)}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      t.delta >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {t.delta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {t.delta >= 0 ? "+" : ""}
                    {t.delta.toFixed(1)}
                  </span>
                  {t.stage && (
                    <Tag
                      color={STAGE_TAG[t.stage]?.color}
                      variant="filled"
                      className="!m-0"
                    >
                      {STAGE_TAG[t.stage]?.label}
                    </Tag>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

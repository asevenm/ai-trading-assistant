"use client"

import { useEffect, useState } from "react"
import { Card, Empty, Spin, Tag } from "antd"
import Link from "next/link"

interface RotationDailyReviewSectionProps {
  boardType?: "INDUSTRY" | "CONCEPT"
}

interface MainlineEntry {
  boardId: string
  boardName: string
  strengthScore: number
  deltaScore: number | null
  stage: string | null
  stageReason: string | null
  limitUpCount: number
  topStreak: number
  leaderStocks: string[]
}

interface BoardEvolution {
  boardId: string
  boardName: string
  scores: Record<string, number>
}

interface Response {
  tradeDate: string
  prevTradeDate: string | null
  timeSlots: string[]
  boards: BoardEvolution[]
  topMainline: MainlineEntry[]
  risingFromYesterday: { boardId: string; boardName: string; strengthScore: number; stage: string | null }[]
  fadedFromYesterday: { boardId: string; boardName: string; yesterdayScore: number; stage: string | null }[]
}

const STAGE_TAG: Record<string, { color: string; label: string }> = {
  STARTING: { color: "green", label: "🟢 启动" },
  RISING: { color: "red", label: "🔥 主升" },
  DIVERGING: { color: "orange", label: "⚠️ 分歧" },
  FADING: { color: "default", label: "🔻 退潮" },
}

/**
 * 把强度分映射为热力图色（0-100 → 灰→黄→橙→红）
 */
function scoreToHeatColor(score: number | undefined): string {
  if (score === undefined || score === null) return "transparent"
  if (score < 30) return "#f1f5f9"
  if (score < 50) return "#fef3c7"
  if (score < 65) return "#fde68a"
  if (score < 75) return "#fb923c"
  if (score < 85) return "#f87171"
  return "#dc2626"
}

export function RotationDailyReviewSection({
  boardType = "CONCEPT",
}: RotationDailyReviewSectionProps) {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/rotation/daily-evolution?boardType=${boardType}&topN=20`,
          { cache: "no-store" }
        )
        if (!res.ok) throw new Error("Failed")
        const json = (await res.json()) as Response
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

  if (!data || data.boards.length === 0) {
    return (
      <Card variant="borderless" className="mt-4" title="今日轮动复盘">
        <Empty description="暂无快照数据。请在题材雷达页面或轮动实时页面手动触发快照采集，累积数据后再来查看。" />
      </Card>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      {/* 主线判定卡 */}
      <Card variant="borderless" title={`今日主线 Top 3（${boardType === "CONCEPT" ? "概念" : "行业"}板块）`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.topMainline.map((m) => (
            <div key={m.boardId} className="border border-border rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <Link href={`/sector/${m.boardId}`} className="text-base font-semibold">
                  {m.boardName}
                </Link>
                {m.stage && (
                  <Tag color={STAGE_TAG[m.stage]?.color} variant="filled" className="!m-0">
                    {STAGE_TAG[m.stage]?.label}
                  </Tag>
                )}
              </div>
              <div className="text-sm">
                <span className="text-muted">强度分</span>
                <span className="font-bold ml-1">{m.strengthScore.toFixed(1)}</span>
                {m.deltaScore !== null && (
                  <span
                    className={`ml-2 ${m.deltaScore >= 0 ? "text-up" : "text-down"}`}
                  >
                    Δ{m.deltaScore >= 0 ? "+" : ""}
                    {m.deltaScore.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted mt-1">
                涨停 {m.limitUpCount} · 最高 {m.topStreak} 板
              </div>
              {m.leaderStocks.length > 0 && (
                <div className="text-xs mt-1">
                  龙头：
                  {m.leaderStocks.map((code) => (
                    <Link key={code} href={`/stock/${code}`}>
                      <Tag className="!m-0 ml-1 cursor-pointer">{code}</Tag>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 轮动热力图 */}
      <Card variant="borderless" title="📊 全天轮动热力图（颜色越红强度越高）">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-1 sticky left-0 bg-white z-10">板块</th>
                {data.timeSlots.map((slot) => (
                  <th key={slot} className="p-1 text-center">
                    {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.boards.map((b) => (
                <tr key={b.boardId}>
                  <td className="p-1 sticky left-0 bg-white z-10 truncate max-w-[120px]">
                    <Link href={`/sector/${b.boardId}`}>{b.boardName}</Link>
                  </td>
                  {data.timeSlots.map((slot) => {
                    const score = b.scores[slot]
                    return (
                      <td key={slot} className="p-0">
                        <div
                          className="h-7 flex items-center justify-center text-[11px] font-medium"
                          style={{
                            backgroundColor: scoreToHeatColor(score),
                            color: score && score >= 75 ? "#fff" : "#374151",
                          }}
                        >
                          {score !== undefined ? score.toFixed(0) : "-"}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 切换轨迹 */}
      {data.prevTradeDate && (
        <Card variant="borderless" title={`🔄 切换轨迹（vs ${data.prevTradeDate}）`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted mb-2">
                ⬆️ 今日新进 Top 10（昨日不在）
              </div>
              {data.risingFromYesterday.length === 0 ? (
                <div className="text-xs text-muted">无</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.risingFromYesterday.map((r) => (
                    <Tag key={r.boardId} color="red" variant="filled" className="!m-0">
                      {r.boardName} S={r.strengthScore.toFixed(0)}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm text-muted mb-2">⬇️ 昨日掉出 Top 10</div>
              {data.fadedFromYesterday.length === 0 ? (
                <div className="text-xs text-muted">无</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.fadedFromYesterday.map((r) => (
                    <Tag key={r.boardId} color="default" variant="filled" className="!m-0">
                      {r.boardName} 昨S={r.yesterdayScore.toFixed(0)}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

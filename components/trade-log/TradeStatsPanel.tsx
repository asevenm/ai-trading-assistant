"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, Spin, Tag, Statistic, Row, Col, App } from "antd"

interface ReasonStats {
  reason: string
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number
  totalPnL: number
  avgPnL: number
}

interface StockComparison {
  code: string
  name: string
  trades: number
  wins: number
  pnl: number
}

interface StatsData {
  overview: {
    totalTrades: number
    totalSells: number
    totalWins: number
    winRate: number
    totalPnL: number
    avgPnL: number
    maxWin: number
    maxLoss: number
  }
  byReason: ReasonStats[]
  stockComparison: StockComparison[]
}

export function TradeStatsPanel() {
  const { message } = App.useApp()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-logs/stats?months=3")
      if (!res.ok) throw new Error("Failed")
      setData(await res.json())
    } catch {
      message.error("加载统计数据失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    )
  }

  if (!data) return null

  const { overview } = data

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <Row gutter={16}>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic title="总交易" value={overview.totalTrades} suffix="笔" />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="胜率"
              value={overview.winRate}
              precision={1}
              suffix="%"
              styles={{
                content: {
                  color: overview.winRate >= 50 ? "var(--trading-up)" : "var(--trading-down)",
                },
              }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="总盈亏"
              value={overview.totalPnL}
              precision={0}
              prefix={overview.totalPnL >= 0 ? "+" : ""}
              styles={{
                content: {
                  color: overview.totalPnL >= 0 ? "var(--trading-up)" : "var(--trading-down)",
                },
              }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="平均盈亏"
              value={overview.avgPnL}
              precision={0}
              prefix={overview.avgPnL >= 0 ? "+" : ""}
              styles={{
                content: {
                  color: overview.avgPnL >= 0 ? "var(--trading-up)" : "var(--trading-down)",
                },
              }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="最大盈利"
              value={overview.maxWin}
              precision={0}
              prefix="+"
              styles={{ content: { color: "var(--trading-up)" } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="最大亏损"
              value={overview.maxLoss}
              precision={0}
              styles={{ content: { color: "var(--trading-down)" } }}
            />
          </Card>
        </Col>
      </Row>

      {/* By Strategy/Reason */}
      <Card title="按策略分类统计" variant="borderless">
        {data.byReason.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">暂无分类数据</div>
        ) : (
          <div className="space-y-3">
            {data.byReason.map((r) => (
              <div
                key={r.reason}
                className="flex items-center justify-between p-3 rounded bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <Tag variant="filled" color="blue">{r.reason}</Tag>
                  <span className="text-sm text-muted-foreground">
                    {r.totalTrades}笔
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span>
                    胜率{" "}
                    <span className={r.winRate >= 50 ? "text-up font-medium" : "text-down font-medium"}>
                      {r.winRate.toFixed(1)}%
                    </span>
                  </span>
                  <span>
                    {r.winCount}胜 / {r.lossCount}负
                  </span>
                  <span className={r.totalPnL >= 0 ? "text-up font-medium" : "text-down font-medium"}>
                    {r.totalPnL >= 0 ? "+" : ""}{r.totalPnL.toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">
                    均{r.avgPnL >= 0 ? "+" : ""}{r.avgPnL.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Same Stock Comparison */}
      <Card title="同股票交易对比" variant="borderless">
        {data.stockComparison.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            需同一股票交易≥2次才会显示
          </div>
        ) : (
          <div className="space-y-3">
            {data.stockComparison.map((s) => (
              <div
                key={s.code}
                className="flex items-center justify-between p-3 rounded bg-white/5"
              >
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{s.code}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span>{s.trades}笔</span>
                  <span>
                    胜率{" "}
                    <span
                      className={
                        s.trades > 0 && s.wins / s.trades >= 0.5
                          ? "text-up font-medium"
                          : "text-down font-medium"
                      }
                    >
                      {s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(0) : 0}%
                    </span>
                  </span>
                  <span className={s.pnl >= 0 ? "text-up font-medium" : "text-down font-medium"}>
                    {s.pnl >= 0 ? "+" : ""}{s.pnl.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

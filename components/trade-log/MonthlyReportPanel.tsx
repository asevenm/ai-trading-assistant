"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, Spin, Statistic, Row, Col, DatePicker, App } from "antd"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { BarChart, LineChart } from "echarts/charts"
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import dayjs from "dayjs"

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

interface MonthlyData {
  month: string
  overview: {
    totalTrades: number
    buyCount: number
    sellCount: number
    wins: number
    losses: number
    winRate: number
    totalPnL: number
    avgPnL: number
    maxWin: number
    maxLoss: number
  }
  weeklyPnL: { week: string; pnl: number; trades: number }[]
  byReason: { reason: string; wins: number; losses: number; pnl: number; total: number; winRate: number }[]
  pnlCurve: { date: string; pnl: number; cumulative: number; stock: string }[]
}

export function MonthlyReportPanel() {
  const { message } = App.useApp()
  const [data, setData] = useState<MonthlyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(dayjs())

  const fetchReport = useCallback(async (m: dayjs.Dayjs) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/trade-logs/monthly-report?month=${m.format("YYYY-MM")}`)
      if (!res.ok) throw new Error("Failed")
      setData(await res.json())
    } catch {
      message.error("加载月报失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchReport(month)
  }, [fetchReport, month])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    )
  }

  if (!data) return null

  const { overview } = data

  const pnlCurveOption = {
    tooltip: {
      trigger: "axis" as const,
      formatter: (params: Array<{ value: number; axisValue: string; seriesName: string }>) => {
        const date = params[0]?.axisValue
        const lines = params.map(
          (p) => `${p.seriesName}: ${p.value >= 0 ? "+" : ""}${p.value.toFixed(0)}`
        )
        return `${date}<br/>${lines.join("<br/>")}`
      },
    },
    legend: {
      data: ["单笔盈亏", "累计盈亏"],
      textStyle: { color: "#999" },
    },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: "category" as const,
      data: data.pnlCurve.map((d) => d.date),
      axisLabel: { color: "#999" },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: "#999" },
    },
    series: [
      {
        name: "单笔盈亏",
        type: "bar",
        data: data.pnlCurve.map((d) => d.pnl),
        itemStyle: {
          color: (params: { value: number }) =>
            params.value >= 0 ? "#f5222d" : "#52c41a",
        },
      },
      {
        name: "累计盈亏",
        type: "line",
        data: data.pnlCurve.map((d) => d.cumulative),
        itemStyle: { color: "#faad14" },
        lineStyle: { width: 2 },
        symbol: "circle",
        symbolSize: 4,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(250, 173, 20, 0.3)" },
            { offset: 1, color: "rgba(250, 173, 20, 0.05)" },
          ]),
        },
      },
    ],
  }

  const weeklyOption = {
    tooltip: { trigger: "axis" as const },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: "category" as const,
      data: data.weeklyPnL.map((d) => d.week),
      axisLabel: { color: "#999" },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: "#999" },
    },
    series: [
      {
        type: "bar",
        data: data.weeklyPnL.map((d) => d.pnl),
        itemStyle: {
          color: (params: { value: number }) =>
            params.value >= 0 ? "#f5222d" : "#52c41a",
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true,
          position: "top" as const,
          formatter: (params: { value: number }) =>
            params.value >= 0 ? `+${params.value.toFixed(0)}` : params.value.toFixed(0),
          color: "#999",
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">月度交易报告</h3>
        <DatePicker
          picker="month"
          value={month}
          onChange={(val) => val && setMonth(val)}
          allowClear={false}
        />
      </div>

      {/* Overview */}
      <Row gutter={16}>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic title="交易笔数" value={overview.totalTrades} />
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
            <Statistic title="胜/负" value={`${overview.wins}/${overview.losses}`} />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="最大盈利"
              value={overview.maxWin}
              precision={0}
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

      {/* PnL Curve */}
      {data.pnlCurve.length > 0 && (
        <Card title="盈亏曲线" variant="borderless">
          <ReactEChartsCore echarts={echarts} option={pnlCurveOption} style={{ height: 300 }} />
        </Card>
      )}

      {/* Weekly PnL */}
      {data.weeklyPnL.length > 0 && (
        <Card title="周度盈亏" variant="borderless">
          <ReactEChartsCore echarts={echarts} option={weeklyOption} style={{ height: 250 }} />
        </Card>
      )}

      {/* By Reason */}
      {data.byReason.length > 0 && (
        <Card title="策略分类" variant="borderless">
          <div className="space-y-2">
            {data.byReason.map((r) => (
              <div
                key={r.reason}
                className="flex items-center justify-between p-2 rounded bg-white/5"
              >
                <span className="font-medium">{r.reason}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span>{r.total}笔</span>
                  <span className={r.winRate >= 50 ? "text-up" : "text-down"}>
                    胜率 {r.winRate.toFixed(0)}%
                  </span>
                  <span className={r.pnl >= 0 ? "text-up" : "text-down"}>
                    {r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {overview.totalTrades === 0 && (
        <div className="text-center text-muted-foreground py-12">
          本月暂无交易记录
        </div>
      )}
    </div>
  )
}

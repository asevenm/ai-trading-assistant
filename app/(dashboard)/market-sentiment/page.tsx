"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, Button, Spin, Row, Col, Statistic, Progress, Tag, App } from "antd"
import {
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  PauseOutlined,
  ThunderboltOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { BarChart, LineChart } from "echarts/charts"
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import type { MarketIndex, NorthboundFlow, MarketStats } from "@/lib/market-api"
import type { SectorFlow } from "@/lib/sector-flow-api"

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

interface TurnoverItem {
  date: string
  shTurnover: number
  szTurnover: number
  total: number
}

interface NorthboundTrendItem {
  date: string
  shNet: number
  szNet: number
  totalNet: number
}

interface SentimentData {
  indices: MarketIndex[]
  stats: MarketStats
  northbound: NorthboundFlow | null
  limitUpCount: number
  limitDownCount: number
  bustedCount: number
  bustedRate: number
  sectorFlow: SectorFlow[]
  sentiment: { score: number; label: string }
  turnoverTrend: TurnoverItem[]
  northboundTrend: NorthboundTrendItem[]
}

function getSentimentColor(score: number): string {
  if (score >= 80) return "#f5222d"
  if (score >= 60) return "#fa8c16"
  if (score >= 40) return "#1890ff"
  if (score >= 20) return "#52c41a"
  return "#389e0d"
}

export default function MarketSentimentPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/market-sentiment")
      if (!res.ok) throw new Error("Failed")
      setData(await res.json())
    } catch {
      message.error("加载市场数据失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (!data) return null

  const { stats, sentiment, northbound } = data

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">市场情绪仪表盘</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 综合情绪指数 */}
      <Card variant="borderless" className="mb-6">
        <div className="flex items-center justify-center gap-12">
          <div className="text-center">
            <Progress
              type="dashboard"
              percent={sentiment.score}
              strokeColor={getSentimentColor(sentiment.score)}
              size={180}
              format={(percent) => (
                <div>
                  <div className="text-3xl font-bold">{percent}</div>
                  <div className="text-sm text-muted-foreground">情绪指数</div>
                </div>
              )}
            />
          </div>
          <div className="space-y-4">
            <div>
              <Tag
                color={getSentimentColor(sentiment.score)}
                variant="filled"
                className="text-lg px-4 py-1"
              >
                {sentiment.label}
              </Tag>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>0-20: 极度恐慌 | 20-40: 偏空</div>
              <div>40-60: 中性 | 60-80: 偏多</div>
              <div>80-100: 极度贪婪</div>
            </div>
          </div>
        </div>
      </Card>

      {/* 大盘指数 */}
      <Row gutter={16} className="mb-6">
        {data.indices.map((idx) => (
          <Col key={idx.code} span={6}>
            <Card variant="borderless" size="small">
              <Statistic
                title={idx.name}
                value={idx.price}
                precision={2}
                styles={{
                  content: {
                    color: idx.changePercent >= 0
                      ? "var(--trading-up)"
                      : "var(--trading-down)",
                    fontSize: 20,
                  },
                }}
                prefix={idx.changePercent >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                suffix={
                  <span className="text-sm">
                    {idx.changePercent >= 0 ? "+" : ""}
                    {idx.changePercent.toFixed(2)}%
                  </span>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 核心指标 */}
      <Row gutter={16} className="mb-6">
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="上涨"
              value={stats.upCount}
              suffix="家"
              prefix={<RiseOutlined />}
              styles={{ content: { color: "var(--trading-up)", fontSize: 18 } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="下跌"
              value={stats.downCount}
              suffix="家"
              prefix={<FallOutlined />}
              styles={{ content: { color: "var(--trading-down)", fontSize: 18 } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="平盘"
              value={stats.flatCount}
              suffix="家"
              prefix={<PauseOutlined />}
              styles={{ content: { fontSize: 18 } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="涨停"
              value={data.limitUpCount}
              suffix="只"
              styles={{ content: { color: "var(--trading-up)", fontSize: 18, fontWeight: "bold" } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="跌停"
              value={data.limitDownCount}
              suffix="只"
              styles={{ content: { color: "var(--trading-down)", fontSize: 18, fontWeight: "bold" } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="炸板率"
              value={data.bustedRate}
              precision={1}
              suffix="%"
              prefix={<ThunderboltOutlined />}
              styles={{
                content: {
                  color: data.bustedRate > 30 ? "var(--trading-down)" : "var(--trading-up)",
                  fontSize: 18,
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 涨跌比 + 北向资金 */}
      <Row gutter={16} className="mb-6">
        <Col span={12}>
          <Card title="涨跌比" variant="borderless" size="small">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-up">{stats.upCount} 上涨</span>
                <span className="text-down">{stats.downCount} 下跌</span>
              </div>
              <div className="flex h-4 rounded overflow-hidden">
                <div
                  className="bg-[var(--trading-up)]"
                  style={{
                    width: `${(stats.upCount / Math.max(stats.upCount + stats.downCount + stats.flatCount, 1)) * 100}%`,
                  }}
                />
                <div
                  className="bg-gray-500"
                  style={{
                    width: `${(stats.flatCount / Math.max(stats.upCount + stats.downCount + stats.flatCount, 1)) * 100}%`,
                  }}
                />
                <div
                  className="bg-[var(--trading-down)]"
                  style={{
                    width: `${(stats.downCount / Math.max(stats.upCount + stats.downCount + stats.flatCount, 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">
                涨跌比 {(stats.upCount / Math.max(stats.downCount, 1)).toFixed(2)}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="北向资金" variant="borderless" size="small">
            {northbound ? (
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="沪股通"
                    value={(northbound.shNet / 1e8).toFixed(1)}
                    suffix="亿"
                    styles={{
                      content: {
                        color: northbound.shNet >= 0 ? "var(--trading-up)" : "var(--trading-down)",
                        fontSize: 16,
                      },
                    }}
                    prefix={northbound.shNet >= 0 ? "+" : ""}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="深股通"
                    value={(northbound.szNet / 1e8).toFixed(1)}
                    suffix="亿"
                    styles={{
                      content: {
                        color: northbound.szNet >= 0 ? "var(--trading-up)" : "var(--trading-down)",
                        fontSize: 16,
                      },
                    }}
                    prefix={northbound.szNet >= 0 ? "+" : ""}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="合计"
                    value={(northbound.totalNet / 1e8).toFixed(1)}
                    suffix="亿"
                    styles={{
                      content: {
                        color: northbound.totalNet >= 0 ? "var(--trading-up)" : "var(--trading-down)",
                        fontSize: 16,
                        fontWeight: "bold",
                      },
                    }}
                    prefix={northbound.totalNet >= 0 ? "+" : ""}
                  />
                </Col>
              </Row>
            ) : (
              <div className="text-center text-muted-foreground py-4">暂无数据</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 两市成交额趋势 */}
      {data.turnoverTrend.length > 0 && (
        <Card title="两市成交额趋势（近20日）" variant="borderless" className="mb-6">
          <TurnoverChart data={data.turnoverTrend} />
        </Card>
      )}

      {/* 北向资金趋势 */}
      {data.northboundTrend.length > 0 && (
        <Card title="北向资金净流入趋势（近20日）" variant="borderless" className="mb-6">
          <NorthboundChart data={data.northboundTrend} />
        </Card>
      )}

      {/* 板块资金流向 */}
      <Card title="板块资金流向 Top10" variant="borderless">
        <div className="space-y-2">
          {data.sectorFlow.map((s, i) => {
            const isInflow = s.mainNetInflow > 0
            const maxFlow = Math.max(...data.sectorFlow.map((x) => Math.abs(x.mainNetInflow)))
            const barWidth = (Math.abs(s.mainNetInflow) / maxFlow) * 100
            return (
              <div key={s.code} className="flex items-center gap-3">
                <span className="w-5 text-right font-bold text-muted-foreground">{i + 1}</span>
                <span className="w-20 font-medium truncate">{s.name}</span>
                <span
                  className={`w-16 text-right ${s.changePercent >= 0 ? "text-up" : "text-down"}`}
                >
                  {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
                </span>
                <div className="flex-1 flex items-center">
                  <div
                    className={`h-4 rounded ${isInflow ? "bg-[var(--trading-up)]" : "bg-[var(--trading-down)]"}`}
                    style={{ width: `${barWidth}%`, opacity: 0.7 }}
                  />
                </div>
                <span
                  className={`w-24 text-right font-medium ${isInflow ? "text-up" : "text-down"}`}
                >
                  {isInflow ? "+" : ""}{(s.mainNetInflow / 1e8).toFixed(1)}亿
                </span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function TurnoverChart({ data }: { data: TurnoverItem[] }) {
  const option = {
    tooltip: {
      trigger: "axis" as const,
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: string }>) => {
        const date = params[0]?.axisValue
        const lines = params.map(
          (p) => `${p.seriesName}: ${(p.value / 1e8).toFixed(0)}亿`
        )
        return `${date}<br/>${lines.join("<br/>")}`
      },
    },
    legend: {
      data: ["沪市", "深市", "合计"],
      textStyle: { color: "#999" },
    },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => d.date.slice(5)),
      axisLabel: { color: "#999" },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: {
        color: "#999",
        formatter: (val: number) => `${(val / 1e8).toFixed(0)}亿`,
      },
    },
    series: [
      {
        name: "沪市",
        type: "bar",
        stack: "turnover",
        data: data.map((d) => d.shTurnover),
        itemStyle: { color: "#f5222d", opacity: 0.7 },
      },
      {
        name: "深市",
        type: "bar",
        stack: "turnover",
        data: data.map((d) => d.szTurnover),
        itemStyle: { color: "#1890ff", opacity: 0.7 },
      },
      {
        name: "合计",
        type: "line",
        data: data.map((d) => d.total),
        itemStyle: { color: "#faad14" },
        lineStyle: { width: 2 },
        symbol: "circle",
        symbolSize: 4,
      },
    ],
  }

  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 300 }} />
}

function NorthboundChart({ data }: { data: NorthboundTrendItem[] }) {
  const option = {
    tooltip: {
      trigger: "axis" as const,
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: string }>) => {
        const date = params[0]?.axisValue
        const lines = params.map(
          (p) => `${p.seriesName}: ${p.value >= 0 ? "+" : ""}${p.value.toFixed(1)}亿`
        )
        return `${date}<br/>${lines.join("<br/>")}`
      },
    },
    legend: {
      data: ["沪股通", "深股通", "合计"],
      textStyle: { color: "#999" },
    },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => d.date.slice(5)),
      axisLabel: { color: "#999" },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: {
        color: "#999",
        formatter: (val: number) => `${val.toFixed(0)}亿`,
      },
    },
    series: [
      {
        name: "沪股通",
        type: "bar",
        data: data.map((d) => d.shNet),
        itemStyle: {
          color: (params: { value: number }) =>
            params.value >= 0 ? "#f5222d" : "#52c41a",
        },
      },
      {
        name: "深股通",
        type: "bar",
        data: data.map((d) => d.szNet),
        itemStyle: {
          color: (params: { value: number }) =>
            params.value >= 0 ? "#ff7a45" : "#73d13d",
        },
      },
      {
        name: "合计",
        type: "line",
        data: data.map((d) => d.totalNet),
        itemStyle: { color: "#faad14" },
        lineStyle: { width: 2 },
        symbol: "circle",
        symbolSize: 6,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(250, 173, 20, 0.3)" },
            { offset: 1, color: "rgba(250, 173, 20, 0.05)" },
          ]),
        },
      },
    ],
  }

  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 300 }} />
}

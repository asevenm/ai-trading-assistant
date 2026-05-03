"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button, Spin, Card, Table, Tag, Tabs, Row, Col, Statistic } from "antd"
import { ArrowLeftOutlined, ArrowUpOutlined, ArrowDownOutlined, RiseOutlined, FallOutlined } from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import ReactECharts from "echarts-for-react"
import Link from "next/link"
import type { SectorQuote, SectorKlineItem, SectorMember, SectorCapitalFlowPoint } from "@/lib/sector-api"
import { calculateMA } from "@/lib/indicators"

type KlinePeriod = "daily" | "weekly" | "monthly"

function formatAmount(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e7) return (v / 1e8).toFixed(2) + "亿"
  if (abs >= 1e4) return (v / 1e4).toFixed(0) + "万"
  return v.toFixed(0)
}

function formatVol(v: number): string {
  if (v >= 1e7) return (v / 1e8).toFixed(2) + "亿"
  if (v >= 1e4) return (v / 1e4).toFixed(0) + "万"
  return String(v)
}

export default function SectorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const [quote, setQuote] = useState<SectorQuote | null>(null)
  const [kline, setKline] = useState<SectorKlineItem[]>([])
  const [members, setMembers] = useState<SectorMember[]>([])
  const [capitalFlow, setCapitalFlow] = useState<SectorCapitalFlowPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [klinePeriod, setKlinePeriod] = useState<KlinePeriod>("daily")

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/sector?action=quote&code=${code}`)
      if (res.ok) setQuote(await res.json())
    } catch { /* ignore */ }
  }, [code])

  const fetchKline = useCallback(async () => {
    try {
      const res = await fetch(`/api/sector?action=kline&code=${code}&period=${klinePeriod}&count=120`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setKline(data)
      }
    } catch { /* ignore */ }
  }, [code, klinePeriod])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/sector?action=members&code=${code}&count=50`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setMembers(data)
      }
    } catch { /* ignore */ }
  }, [code])

  const fetchCapitalFlow = useCallback(async () => {
    try {
      const res = await fetch(`/api/sector?action=capital-intraday&code=${code}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setCapitalFlow(data)
      }
    } catch { /* ignore */ }
  }, [code])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchQuote(), fetchMembers(), fetchCapitalFlow()])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchQuote, fetchMembers, fetchCapitalFlow])

  useEffect(() => {
    const load = async () => { await fetchKline() }
    load()
  }, [fetchKline])

  // K-line chart option
  const klineOption = useMemo(() => {
    if (kline.length === 0) return {}
    const dates = kline.map((d) => d.date)
    const closes = kline.map((d) => d.close)
    const volumes = kline.map((d) => d.volume)
    const ma5 = calculateMA(closes, 5)
    const ma10 = calculateMA(closes, 10)
    const ma20 = calculateMA(closes, 20)
    const candlestickData = kline.map((d) => [d.open, d.close, d.low, d.high])
    const volumeColors = kline.map((d) =>
      d.close >= d.open ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.6)"
    )
    return {
      animation: false,
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "cross" }, backgroundColor: "rgba(20,20,20,0.95)", borderColor: "#262626", textStyle: { color: "#ededed", fontSize: 12 } },
      axisPointer: { link: [{ xAxisIndex: [0, 1] }] },
      grid: [
        { left: 60, right: 20, top: 30, height: "55%" },
        { left: 60, right: 20, top: "72%", height: "18%" },
      ],
      xAxis: [
        { type: "category", data: dates, gridIndex: 0, axisLine: { lineStyle: { color: "#262626" } }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
        { type: "category", data: dates, gridIndex: 1, axisLine: { lineStyle: { color: "#262626" } }, axisTick: { show: false }, axisLabel: { color: "#a1a1a1", fontSize: 10, formatter: (v: string) => v.slice(5) }, splitLine: { show: false } },
      ],
      yAxis: [
        { type: "value", gridIndex: 0, scale: true, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "#1c1c1c" } }, axisLabel: { color: "#a1a1a1", fontSize: 10 } },
        { type: "value", gridIndex: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: "#a1a1a1", fontSize: 10, formatter: (v: number) => formatVol(v) } },
      ],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1], start: 60, end: 100 }],
      series: [
        { name: "K线", type: "candlestick", data: candlestickData, xAxisIndex: 0, yAxisIndex: 0, itemStyle: { color: "#ef4444", color0: "#22c55e", borderColor: "#ef4444", borderColor0: "#22c55e" } },
        { name: "MA5", type: "line", data: ma5, xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#f59e0b" } },
        { name: "MA10", type: "line", data: ma10, xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#3b82f6" } },
        { name: "MA20", type: "line", data: ma20, xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#a855f6" } },
        { name: "成交量", type: "bar", data: volumes.map((v, i) => ({ value: v, itemStyle: { color: volumeColors[i] } })), xAxisIndex: 1, yAxisIndex: 1 },
      ],
    }
  }, [kline])

  // Capital flow chart option
  const flowOption = useMemo(() => {
    if (capitalFlow.length === 0) return {}
    const times = capitalFlow.map((p) => {
      const t = p.time
      return t.includes(" ") ? t.split(" ")[1]?.slice(0, 5) : t.slice(0, 5)
    })
    const cumMain: number[] = []
    let cum = 0
    for (const p of capitalFlow) { cum += p.mainNet; cumMain.push(cum) }
    return {
      animation: false,
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", backgroundColor: "rgba(20,20,20,0.95)", borderColor: "#262626", textStyle: { color: "#ededed", fontSize: 12 } },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: "category", data: times, axisLine: { lineStyle: { color: "#262626" } }, axisLabel: { color: "#a1a1a1", fontSize: 10 }, axisTick: { show: false } },
      yAxis: { type: "value", axisLine: { show: false }, splitLine: { lineStyle: { color: "#1c1c1c" } }, axisLabel: { color: "#a1a1a1", fontSize: 10, formatter: (v: number) => formatAmount(v) } },
      series: [
        {
          name: "主力净流入累计", type: "line", data: cumMain, smooth: true, showSymbol: false,
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(239,68,68,0.3)" }, { offset: 0.5, color: "rgba(239,68,68,0)" }, { offset: 0.5, color: "rgba(34,197,94,0)" }, { offset: 1, color: "rgba(34,197,94,0.3)" }] } },
          lineStyle: { color: "#f59e0b", width: 2 }, itemStyle: { color: "#f59e0b" },
        },
      ],
    }
  }, [capitalFlow])

  const memberColumns: ColumnsType<SectorMember> = [
    {
      title: "代码", dataIndex: "code", width: 80,
      render: (v: string) => <Link href={`/stock/${v}`} className="font-mono text-primary hover:underline">{v}</Link>,
    },
    {
      title: "名称", dataIndex: "name", width: 100,
      render: (v: string, r) => <Link href={`/stock/${r.code}`} className="text-primary hover:underline">{v}</Link>,
    },
    {
      title: "现价", dataIndex: "price", width: 80, align: "right",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "涨跌幅", dataIndex: "changePercent", width: 90, align: "right",
      defaultSortOrder: "descend", sorter: (a, b) => a.changePercent - b.changePercent,
      render: (v: number) => <span className={v >= 0 ? "text-up" : "text-down"}>{v >= 0 ? "+" : ""}{v.toFixed(2)}%</span>,
    },
    {
      title: "换手率", dataIndex: "turnoverRate", width: 80, align: "right",
      sorter: (a, b) => a.turnoverRate - b.turnoverRate,
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: "主力净流入", dataIndex: "mainNetInflow", width: 110, align: "right",
      sorter: (a, b) => a.mainNetInflow - b.mainNetInflow,
      render: (v: number) => <span className={v >= 0 ? "text-up" : "text-down"}>{formatAmount(v)}</span>,
    },
  ]

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>
  }

  const changePercent = quote?.changePercent ?? 0
  const isUp = changePercent > 0

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} className="mb-4">返回</Button>

      {/* 头部信息 */}
      {quote && (
        <div className="bg-card p-6 rounded-lg border border-border mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold">{quote.name}</h1>
              <span className="text-muted-foreground text-sm">{quote.code}</span>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${isUp ? "text-up" : "text-down"}`}>
                {quote.price.toFixed(2)}
              </div>
              <div className={`flex items-center gap-1 justify-end ${isUp ? "text-up" : "text-down"}`}>
                {isUp ? <RiseOutlined /> : <FallOutlined />}
                <span>{quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}</span>
                <span>({changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%)</span>
              </div>
            </div>
          </div>
          <Row gutter={16}>
            <Col span={3}>
              <Statistic title="上涨" value={quote.upCount} styles={{ content: { fontSize: 14, color: "var(--trading-up)" } }} prefix={<ArrowUpOutlined />} />
            </Col>
            <Col span={3}>
              <Statistic title="下跌" value={quote.downCount} styles={{ content: { fontSize: 14, color: "var(--trading-down)" } }} prefix={<ArrowDownOutlined />} />
            </Col>
            <Col span={4}>
              <Statistic title="成交额" value={formatAmount(quote.turnover)} styles={{ content: { fontSize: 14 } }} />
            </Col>
            <Col span={4}>
              <Statistic title="主力净流入" value={formatAmount(quote.mainNetInflow)} styles={{ content: { fontSize: 14, color: quote.mainNetInflow >= 0 ? "var(--trading-up)" : "var(--trading-down)" } }} />
            </Col>
            <Col span={5}>
              <Statistic title="领涨股" value={quote.leadingStock} styles={{ content: { fontSize: 14 } }} suffix={<Tag color={quote.leadingStockChange >= 0 ? "red" : "green"} className="!text-xs">{quote.leadingStockChange >= 0 ? "+" : ""}{quote.leadingStockChange.toFixed(2)}%</Tag>} />
            </Col>
            <Col span={5}>
              <Statistic title="超大单/大单" value={`${formatAmount(quote.superLargeInflow)} / ${formatAmount(quote.largeInflow)}`} styles={{ content: { fontSize: 12 } }} />
            </Col>
          </Row>
        </div>
      )}

      {/* K线图 */}
      <div className="bg-card rounded-lg border border-border mb-6 p-4">
        <div className="flex items-center gap-4 mb-2">
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <Button key={p} size="small" type={klinePeriod === p ? "primary" : "default"} onClick={() => setKlinePeriod(p)}>
              {p === "daily" ? "日K" : p === "weekly" ? "周K" : "月K"}
            </Button>
          ))}
          <div className="flex items-center gap-3 text-xs">
            <span style={{ color: "#f59e0b" }}>MA5</span>
            <span style={{ color: "#3b82f6" }}>MA10</span>
            <span style={{ color: "#a855f6" }}>MA20</span>
          </div>
        </div>
        {kline.length === 0 ? (
          <div className="flex justify-center items-center h-[400px] text-muted-foreground">暂无K线数据</div>
        ) : (
          <ReactECharts option={klineOption} style={{ height: 400 }} notMerge lazyUpdate />
        )}
      </div>

      {/* Tabs: 资金流向 + 成分股 */}
      <Tabs items={[
        {
          key: "capital",
          label: "板块资金",
          children: (
            <Card size="small">
              {capitalFlow.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">暂无资金流向数据</div>
              ) : (
                <ReactECharts option={flowOption} style={{ height: 260 }} notMerge lazyUpdate />
              )}
            </Card>
          ),
        },
        {
          key: "members",
          label: `成分股 (${members.length})`,
          children: (
            <Card size="small">
              <Table columns={memberColumns} dataSource={members} rowKey="code" size="small" pagination={{ pageSize: 20 }} scroll={{ y: 500 }} />
            </Card>
          ),
        },
      ]} />
    </div>
  )
}

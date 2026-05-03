"use client"

import { useEffect, useState, useCallback } from "react"
import type { CSSProperties } from "react"
import { Card, Button, Spin, Table, Segmented, Row, Col, App, Tag, Tooltip } from "antd"
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import type { SectorFlow, SectorFlowTrendItem, StockFlow } from "@/lib/sector-flow-api"
import Link from "next/link"

interface FlowData {
  sectors: SectorFlow[]
  stocks: StockFlow[]
}

interface FlowTrend {
  dates: string[]
  sectors: SectorFlowTrendItem[]
}

function formatDateShort(date: string): string {
  const parts = date.split("-")
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : date
}

function flowCellStyle(value: number, peak: number): CSSProperties {
  if (peak <= 0 || value === 0) return {}
  const intensity = Math.min(1, Math.abs(value) / peak)
  const alpha = 0.08 + intensity * 0.42
  const color = value > 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(34, 197, 94, ${alpha})`
  return { backgroundColor: color }
}

function formatAmount(val: number): string {
  if (Math.abs(val) >= 1e7) return `${(val / 1e8).toFixed(2)}亿`
  if (Math.abs(val) >= 1e4) return `${(val / 1e4).toFixed(0)}万`
  return val.toFixed(0)
}

function FlowCell({ value }: { value: number }) {
  const isPositive = value > 0
  return (
    <span className={isPositive ? "text-up" : "text-down"}>
      {isPositive ? "+" : ""}{formatAmount(value)}
    </span>
  )
}

export default function SectorFlowPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<FlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [trend, setTrend] = useState<FlowTrend | null>(null)
  const [trendLoading, setTrendLoading] = useState(true)
  const [type, setType] = useState<"industry" | "concept">("industry")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sector-flow?type=${type}`)
      if (!res.ok) throw new Error("Failed")
      setData(await res.json())
    } catch {
      message.error("加载资金流向失败")
    } finally {
      setLoading(false)
    }
  }, [type, message])

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true)
    try {
      const res = await fetch(`/api/sector-flow/weekly?type=${type}&days=5&count=15`)
      if (!res.ok) throw new Error("Failed")
      setTrend(await res.json())
    } catch {
      message.error("加载近一周排行失败")
    } finally {
      setTrendLoading(false)
    }
  }, [type, message])

  useEffect(() => {
    fetchData()
    fetchTrend()
  }, [fetchData, fetchTrend])

  const topInflow = data?.sectors.filter((s) => s.mainNetInflow > 0).slice(0, 5) ?? []
  const topOutflow = data?.sectors
    .filter((s) => s.mainNetInflow < 0)
    .sort((a, b) => a.mainNetInflow - b.mainNetInflow)
    .slice(0, 5) ?? []

  const sectorColumns: ColumnsType<SectorFlow> = [
    {
      title: "板块",
      dataIndex: "name",
      width: 120,
      render: (v: string, record) => (
        <Link href={`/sector/${record.code}`} className="font-medium text-primary hover:underline">{v}</Link>
      ),
    },
    {
      title: "涨幅",
      dataIndex: "changePercent",
      width: 80,
      align: "right",
      sorter: (a, b) => a.changePercent - b.changePercent,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up" : "text-down"}>
          {v >= 0 ? "+" : ""}{v.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "主力净流入",
      dataIndex: "mainNetInflow",
      width: 110,
      align: "right",
      defaultSortOrder: "descend",
      sorter: (a, b) => a.mainNetInflow - b.mainNetInflow,
      render: (v: number) => <FlowCell value={v} />,
    },
    {
      title: "超大单",
      dataIndex: "superLargeInflow",
      width: 100,
      align: "right",
      sorter: (a, b) => a.superLargeInflow - b.superLargeInflow,
      render: (v: number) => <FlowCell value={v} />,
    },
    {
      title: "大单",
      dataIndex: "largeInflow",
      width: 100,
      align: "right",
      sorter: (a, b) => a.largeInflow - b.largeInflow,
      render: (v: number) => <FlowCell value={v} />,
    },
    {
      title: "中单",
      dataIndex: "mediumInflow",
      width: 100,
      align: "right",
      render: (v: number) => <FlowCell value={v} />,
    },
    {
      title: "小单",
      dataIndex: "smallInflow",
      width: 100,
      align: "right",
      render: (v: number) => <FlowCell value={v} />,
    },
  ]

  const stockColumns: ColumnsType<StockFlow> = [
    {
      title: "代码",
      dataIndex: "code",
      width: 80,
      render: (v: string) => (
        <Link href={`/stock/${v}`} className="font-mono text-primary hover:underline">{v}</Link>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      width: 100,
      render: (v: string, record) => (
        <Link href={`/stock/${record.code}`} className="font-medium text-primary hover:underline">{v}</Link>
      ),
    },
    {
      title: "价格",
      dataIndex: "price",
      width: 80,
      align: "right",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "涨幅",
      dataIndex: "changePercent",
      width: 80,
      align: "right",
      render: (v: number) => (
        <span className={v >= 0 ? "text-up" : "text-down"}>
          {v >= 0 ? "+" : ""}{v.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "主力净流入",
      dataIndex: "mainNetInflow",
      width: 120,
      align: "right",
      defaultSortOrder: "descend",
      sorter: (a, b) => a.mainNetInflow - b.mainNetInflow,
      render: (v: number) => <FlowCell value={v} />,
    },
    {
      title: "主力净占比",
      dataIndex: "mainNetInflowPercent",
      width: 100,
      align: "right",
      render: (v: number) => (
        <span className={v >= 0 ? "text-up" : "text-down"}>
          {v >= 0 ? "+" : ""}{v.toFixed(1)}%
        </span>
      ),
    },
  ]

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  const trendDates = trend?.dates ?? []
  const trendPeak = (trend?.sectors ?? []).reduce((max, s) => {
    const localMax = s.daily.reduce((m, d) => Math.max(m, Math.abs(d.mainNet)), 0)
    return Math.max(max, localMax)
  }, 0)

  const trendColumns: ColumnsType<SectorFlowTrendItem> = [
    {
      title: "板块",
      dataIndex: "name",
      width: 120,
      fixed: "left",
      render: (v: string, record) => (
        <Link href={`/sector/${record.code}`} className="font-medium text-primary hover:underline">
          {v}
        </Link>
      ),
    },
    ...trendDates.map<ColumnsType<SectorFlowTrendItem>[number]>((date, idx) => ({
      title: formatDateShort(date),
      key: `d_${date}`,
      width: 90,
      align: "right",
      onCell: (record) => ({
        style: flowCellStyle(record.daily[idx]?.mainNet ?? 0, trendPeak),
      }),
      render: (_, record) => {
        const v = record.daily[idx]?.mainNet ?? 0
        if (v === 0) return <span className="text-gray-400">—</span>
        return <FlowCell value={v} />
      },
    })),
    {
      title: "5日累计",
      dataIndex: "totalNet",
      width: 110,
      align: "right",
      fixed: "right",
      defaultSortOrder: "descend",
      sorter: (a, b) => a.totalNet - b.totalNet,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up font-semibold" : "text-down font-semibold"}>
          {v >= 0 ? "+" : ""}{formatAmount(v)}
        </span>
      ),
    },
    {
      title: (
        <Tooltip title="近 5 个交易日内主力净流入为正的天数">
          <span>红盘天数</span>
        </Tooltip>
      ),
      dataIndex: "positiveDays",
      width: 90,
      align: "center",
      fixed: "right",
      sorter: (a, b) => a.positiveDays - b.positiveDays,
      render: (v: number) => {
        const total = trendDates.length || 5
        const color = v >= total - 1 ? "red" : v >= Math.ceil(total / 2) ? "orange" : "default"
        return <Tag color={color}>{v} / {total}</Tag>
      },
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">板块资金流向</h1>
        <div className="flex items-center gap-4">
          <Segmented
            options={[
              { label: "行业板块", value: "industry" },
              { label: "概念板块", value: "concept" },
            ]}
            value={type}
            onChange={(v) => setType(v as "industry" | "concept")}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchData()
              fetchTrend()
            }}
            loading={loading || trendLoading}
          >
            刷新
          </Button>
        </div>
      </div>

      {/* 资金流入/流出概览 */}
      <Row gutter={16} className="mb-6">
        <Col span={12}>
          <Card title="主力净流入 Top5" variant="borderless" size="small">
            <div className="space-y-2">
              {topInflow.map((s, i) => (
                <div key={s.code} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-up font-bold w-5">{i + 1}</span>
                    <Link href={`/sector/${s.code}`} className="font-medium text-primary hover:underline">{s.name}</Link>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={s.changePercent >= 0 ? "text-up" : "text-down"}>
                      {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
                    </span>
                    <span className="text-up font-medium w-24 text-right">
                      <ArrowUpOutlined className="mr-1" />
                      {formatAmount(s.mainNetInflow)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="主力净流出 Top5" variant="borderless" size="small">
            <div className="space-y-2">
              {topOutflow.map((s, i) => (
                <div key={s.code} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-down font-bold w-5">{i + 1}</span>
                    <Link href={`/sector/${s.code}`} className="font-medium text-primary hover:underline">{s.name}</Link>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={s.changePercent >= 0 ? "text-up" : "text-down"}>
                      {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
                    </span>
                    <span className="text-down font-medium w-24 text-right">
                      <ArrowDownOutlined className="mr-1" />
                      {formatAmount(Math.abs(s.mainNetInflow))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 板块详细数据 */}
      <Card title="板块资金明细" variant="borderless" className="mb-6">
        <Table
          dataSource={data?.sectors ?? []}
          columns={sectorColumns}
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ y: 400 }}
        />
      </Card>

      {/* 近一周每日排行 */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <span>近一周每日资金流向</span>
            <span className="text-xs text-gray-500 font-normal">
              按 5 日累计排序，颜色深浅反映当日净流入强度
            </span>
          </div>
        }
        variant="borderless"
        className="mb-6"
        loading={trendLoading && !trend}
      >
        <Table
          dataSource={trend?.sectors ?? []}
          columns={trendColumns}
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ x: "max-content", y: 480 }}
        />
      </Card>

      {/* 个股主力资金 Top */}
      <Card title="个股主力资金 Top20" variant="borderless">
        <Table
          dataSource={data?.stocks ?? []}
          columns={stockColumns}
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ y: 400 }}
        />
      </Card>
    </div>
  )
}

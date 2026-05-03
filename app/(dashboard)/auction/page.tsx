"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Card,
  Button,
  Spin,
  Row,
  Col,
  Statistic,
  Tag,
  Tabs,
  Table,
  App,
  Empty,
} from "antd"
import {
  ReloadOutlined,
  RiseOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  ArrowUpOutlined,
  BulbOutlined,
  WarningOutlined,
  AimOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { BarChart } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import Link from "next/link"
import type { AuctionStock, AuctionSummary, YesterdayLimitUpAuction } from "@/lib/auction-api"

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

interface AuctionAnalysis {
  sentiment: string
  signals: string[]
  hotThemes: string[]
  watchStocks: { code: string; name: string; reason: string }[]
  strategy: string
  risks: string[]
}

const STATUS_LABELS: Record<YesterdayLimitUpAuction["status"], { text: string; color: string }> = {
  limit_up: { text: "一字", color: "red" },
  high_open: { text: "高开", color: "orange" },
  flat: { text: "平开", color: "default" },
  low_open: { text: "低开", color: "blue" },
  limit_down: { text: "跌停", color: "green" },
}

const formatAmount = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1e7) return `${(v / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}万`
  return v.toFixed(0)
}

const StockLink = ({ code, name }: { code: string; name?: string }) => (
  <Link href={`/stock/${code}`} className="font-medium text-primary hover:underline">
    {name || code}
  </Link>
)

export default function AuctionPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<AuctionSummary | null>(null)
  const [analysis, setAnalysis] = useState<AuctionAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/auction/today")
      if (!res.ok) throw new Error("Failed")
      setData(await res.json())
    } catch {
      message.error("加载竞价数据失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch("/api/auction/analyze", { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      setAnalysis(await res.json())
      message.success("AI 分析完成")
    } catch {
      message.error("AI 分析失败")
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (!data) return null

  const upRatio = data.total > 0 ? (data.upCount / data.total) * 100 : 0
  const gap = data.gapDistribution

  const gapOption = {
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    tooltip: { trigger: "axis" as const },
    xAxis: {
      type: "category" as const,
      data: ["跌停", "<-5%", "-5~-3%", "-3~-1%", "-1~0%", "0~1%", "1~3%", "3~5%", ">5%", "一字"],
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: "value" as const, name: "数量" },
    series: [
      {
        type: "bar" as const,
        data: [
          { value: gap.limitDown, itemStyle: { color: "#15a850" } },
          { value: gap.gapDown5plus, itemStyle: { color: "#52c41a" } },
          { value: gap.gapDown3to5, itemStyle: { color: "#73d13d" } },
          { value: gap.gapDown1to3, itemStyle: { color: "#95de64" } },
          { value: gap.gapDown0to1, itemStyle: { color: "#b7eb8f" } },
          { value: gap.gapUp0to1, itemStyle: { color: "#ffd6d6" } },
          { value: gap.gapUp1to3, itemStyle: { color: "#ff9c9c" } },
          { value: gap.gapUp3to5, itemStyle: { color: "#ff6b6b" } },
          { value: gap.gapUp5plus, itemStyle: { color: "#f5222d" } },
          { value: gap.limitUp, itemStyle: { color: "#a8071a" } },
        ],
        label: { show: true, position: "top" as const, fontSize: 11 },
      },
    ],
  }

  const stockColumns: ColumnsType<AuctionStock> = [
    {
      title: "代码",
      dataIndex: "code",
      width: 80,
      render: (code: string) => (
        <Link href={`/stock/${code}`} className="font-mono text-primary hover:underline">
          {code}
        </Link>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      width: 100,
      render: (name: string, r) => <StockLink code={r.code} name={name} />,
    },
    {
      title: "竞价价",
      dataIndex: "auctionPrice",
      width: 80,
      align: "right",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "涨幅",
      dataIndex: "auctionChange",
      width: 90,
      align: "right",
      sorter: (a, b) => a.auctionChange - b.auctionChange,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up font-medium" : "text-down font-medium"}>
          {v >= 0 ? "+" : ""}
          {v.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "竞价金额",
      dataIndex: "auctionAmount",
      width: 100,
      align: "right",
      sorter: (a, b) => a.auctionAmount - b.auctionAmount,
      render: formatAmount,
    },
    {
      title: "换手",
      dataIndex: "turnoverRate",
      width: 80,
      align: "right",
      render: (v: number) => `${v.toFixed(2)}%`,
    },
    {
      title: "流通市值",
      dataIndex: "marketCap",
      width: 100,
      align: "right",
      render: formatAmount,
    },
  ]

  const yesterdayColumns: ColumnsType<YesterdayLimitUpAuction> = [
    {
      title: "代码",
      dataIndex: "code",
      width: 80,
      render: (code: string) => (
        <Link href={`/stock/${code}`} className="font-mono text-primary hover:underline">
          {code}
        </Link>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      width: 100,
      render: (name: string, r) => <StockLink code={r.code} name={name} />,
    },
    {
      title: "竞价价",
      dataIndex: "auctionPrice",
      width: 80,
      align: "right",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "溢价率",
      dataIndex: "premium",
      width: 90,
      align: "right",
      sorter: (a, b) => a.premium - b.premium,
      defaultSortOrder: "descend",
      render: (v: number) => (
        <span className={v >= 0 ? "text-up font-medium" : "text-down font-medium"}>
          {v >= 0 ? "+" : ""}
          {v.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (s: YesterdayLimitUpAuction["status"]) => {
        const info = STATUS_LABELS[s]
        return (
          <Tag color={info.color} variant="filled">
            {info.text}
          </Tag>
        )
      },
    },
    {
      title: "竞价金额",
      dataIndex: "auctionAmount",
      width: 100,
      align: "right",
      render: formatAmount,
    },
  ]

  const tabItems = [
    {
      key: "gainers",
      label: `涨幅 TOP${data.topGainers.length}`,
      children: (
        <Table
          dataSource={data.topGainers}
          columns={stockColumns}
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ y: 480 }}
        />
      ),
    },
    {
      key: "amount",
      label: `金额 TOP${data.topByAmount.length}`,
      children: (
        <Table
          dataSource={data.topByAmount}
          columns={stockColumns}
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ y: 480 }}
        />
      ),
    },
    {
      key: "yesterday",
      label: `昨涨停今竞价 (${data.yesterdayLimitUp.length})`,
      children:
        data.yesterdayLimitUp.length > 0 ? (
          <Table
            dataSource={data.yesterdayLimitUp}
            columns={yesterdayColumns}
            rowKey="code"
            size="small"
            pagination={false}
            scroll={{ y: 480 }}
          />
        ) : (
          <Empty description="暂无数据" />
        ),
    },
    {
      key: "losers",
      label: `跌幅 TOP${data.topLosers.length}`,
      children: (
        <Table
          dataSource={data.topLosers}
          columns={stockColumns}
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ y: 480 }}
        />
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">集合竞价分析</h1>
        <div className="flex gap-2">
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleAnalyze}
            loading={analyzing}
          >
            AI 综合分析
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      {/* 顶部统计 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="高开比例"
              value={upRatio}
              precision={1}
              suffix="%"
              prefix={<ArrowUpOutlined />}
              styles={{
                content: {
                  color: upRatio >= 50 ? "var(--trading-up)" : "var(--trading-down)",
                },
              }}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {data.upCount} 涨 / {data.downCount} 跌 / {data.flatCount} 平
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="平均竞价涨幅"
              value={data.averageChange}
              precision={2}
              suffix="%"
              prefix={data.averageChange >= 0 ? "+" : ""}
              styles={{
                content: {
                  color:
                    data.averageChange >= 0
                      ? "var(--trading-up)"
                      : "var(--trading-down)",
                },
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="一字涨停"
              value={data.limitUpCount}
              suffix="只"
              prefix={<RiseOutlined />}
              styles={{ content: { color: "var(--trading-up)" } }}
            />
            <div className="text-xs text-muted-foreground mt-1">
              一字跌停 {data.limitDownCount} 只
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="竞价总金额"
              value={data.totalAuctionAmount / 1e8}
              precision={2}
              suffix="亿"
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 跳空缺口分布 */}
      <Card title="跳空缺口分布" variant="borderless" className="mb-6">
        <ReactEChartsCore
          echarts={echarts}
          option={gapOption}
          style={{ height: 280 }}
          notMerge
          lazyUpdate
        />
      </Card>

      {/* AI 分析结果 */}
      {analysis && (
        <Card
          title={
            <span>
              <RobotOutlined className="mr-2" />
              AI 开盘策略分析
            </span>
          }
          variant="borderless"
          className="mb-6"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <BulbOutlined className="text-2xl text-yellow-500 mt-1" />
              <div>
                <div className="text-sm text-muted-foreground">开盘情绪</div>
                <div className="text-lg font-medium">{analysis.sentiment}</div>
              </div>
            </div>

            {analysis.signals.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">关键信号</div>
                <div className="space-y-1">
                  {analysis.signals.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-primary">▸</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.hotThemes.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">热点主题</div>
                <div className="flex flex-wrap gap-2">
                  {analysis.hotThemes.map((t, i) => (
                    <Tag key={i} color="red" variant="filled" className="text-base px-3 py-1">
                      {t}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {analysis.watchStocks.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <AimOutlined /> 重点关注
                </div>
                <div className="space-y-2">
                  {analysis.watchStocks.map((s) => (
                    <div
                      key={s.code}
                      className="flex items-start gap-3 p-3 rounded bg-secondary/30"
                    >
                      <Tag color="red" variant="filled">
                        {s.code}
                      </Tag>
                      <div>
                        <StockLink code={s.code} name={s.name} />
                        <div className="text-sm text-muted-foreground mt-1">{s.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.strategy && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">操作策略</div>
                <div className="text-base leading-relaxed">{analysis.strategy}</div>
              </div>
            )}

            {analysis.risks.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <WarningOutlined className="text-yellow-500" /> 风险提示
                </div>
                <div className="space-y-1">
                  {analysis.risks.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-yellow-500">!</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 个股榜单 */}
      <Card variant="borderless">
        <Tabs items={tabItems} defaultActiveKey="gainers" />
      </Card>
    </div>
  )
}

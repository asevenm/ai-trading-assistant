"use client"

import { useState } from "react"
import {
  Card,
  Button,
  Spin,
  Table,
  Tag,
  InputNumber,
  App,
  Empty,
  Row,
  Col,
  Form,
  Alert,
  Statistic,
  Tooltip,
} from "antd"
import {
  ReloadOutlined,
  TeamOutlined,
  RiseOutlined,
  FundOutlined,
  RadarChartOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import Link from "next/link"

interface AggregatedCousinParent {
  code: string
  name: string
  consecutiveBoards: number
  sharedThemes: string[]
}

interface AggregatedCousinStock {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  volumeRatio: number
  amount: number
  circulationMarketCap: number
  mainNetInflow: number
  industry: string
  parents: AggregatedCousinParent[]
  baseScore: number
  aggregatedScore: number
  scoreFactors: string[]
}

interface AggregatedCousinReport {
  totalLimitUp: number
  themeCount: number
  candidateCount: number
  cousins: AggregatedCousinStock[]
}

const formatAmount = (v: number) => {
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}万`
  return v.toFixed(0)
}

const formatCap = (v: number) => {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}万`
  return v.toFixed(0)
}

const formatInflow = (v: number) => {
  if (Math.abs(v) >= 1e8) return `${v >= 0 ? "+" : ""}${(v / 1e8).toFixed(2)}亿`
  if (Math.abs(v) >= 1e4) return `${v >= 0 ? "+" : ""}${(v / 1e4).toFixed(0)}万`
  return v.toFixed(0)
}

export default function CousinsRadarPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<AggregatedCousinReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [filters, setFilters] = useState({
    limit: 50,
    minBoards: 1,
    maxChange: 5,
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(filters.limit),
        minBoards: String(filters.minBoards),
        maxChange: String(filters.maxChange),
      })
      const res = await fetch(`/api/cousins-radar?${params}`)
      if (!res.ok) throw new Error("Failed")
      const json: AggregatedCousinReport = await res.json()
      setData(json)
      setScanned(true)
      message.success(
        `扫描完成：${json.totalLimitUp} 龙头 → ${json.candidateCount} 候选 → ${json.cousins.length} 兄弟`
      )
    } catch {
      message.error("扫描失败")
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnsType<AggregatedCousinStock> = [
    {
      title: "聚合分",
      dataIndex: "aggregatedScore",
      width: 90,
      align: "center",
      sorter: (a, b) => a.aggregatedScore - b.aggregatedScore,
      defaultSortOrder: "descend",
      render: (v: number, record) => (
        <Tooltip title={`基础分 ${record.baseScore} × 龙头加权`}>
          <Tag
            variant="filled"
            color={
              v >= 100 ? "red" : v >= 70 ? "orange" : v >= 50 ? "magenta" : v >= 30 ? "blue" : "default"
            }
            style={{ minWidth: 50 }}
          >
            <span className="font-bold">{v.toFixed(0)}</span>
          </Tag>
        </Tooltip>
      ),
    },
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
      render: (name: string, record) => (
        <Link href={`/stock/${record.code}`} className="font-medium text-primary hover:underline">
          {name}
        </Link>
      ),
    },
    {
      title: "现价",
      dataIndex: "price",
      width: 70,
      align: "right",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "涨幅",
      dataIndex: "changePercent",
      width: 70,
      align: "right",
      sorter: (a, b) => a.changePercent - b.changePercent,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up font-medium" : "text-down font-medium"}>
          {v >= 0 ? "+" : ""}
          {v.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "拉动龙头",
      dataIndex: "parents",
      width: 280,
      render: (parents: AggregatedCousinParent[]) => (
        <div className="flex flex-wrap gap-1">
          {parents.slice(0, 5).map((p) => (
            <Tooltip
              key={p.code}
              title={`共振板块: ${p.sharedThemes.join("、")}`}
            >
              <Tag
                variant="filled"
                color={p.consecutiveBoards >= 3 ? "purple" : p.consecutiveBoards === 2 ? "magenta" : "blue"}
                style={{ fontSize: 11 }}
              >
                {p.name}
                {p.consecutiveBoards > 1 ? ` ${p.consecutiveBoards}板` : ""}
              </Tag>
            </Tooltip>
          ))}
          {parents.length > 5 && (
            <Tag variant="filled" color="default" style={{ fontSize: 11 }}>
              +{parents.length - 5}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "量比",
      dataIndex: "volumeRatio",
      width: 70,
      align: "right",
      sorter: (a, b) => a.volumeRatio - b.volumeRatio,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "换手",
      dataIndex: "turnoverRate",
      width: 70,
      align: "right",
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: "主力净流入",
      dataIndex: "mainNetInflow",
      width: 110,
      align: "right",
      sorter: (a, b) => a.mainNetInflow - b.mainNetInflow,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up" : "text-down"}>{formatInflow(v)}</span>
      ),
    },
    {
      title: "流通市值",
      dataIndex: "circulationMarketCap",
      width: 100,
      align: "right",
      render: (v: number) => formatCap(v),
    },
    {
      title: "成交额",
      dataIndex: "amount",
      width: 90,
      align: "right",
      render: (v: number) => formatAmount(v),
    },
    {
      title: "评分因子",
      dataIndex: "scoreFactors",
      ellipsis: true,
      render: (factors: string[]) => (
        <div className="flex flex-wrap gap-1">
          {factors.map((f, i) => (
            <Tag key={i} variant="filled" color="cyan" style={{ fontSize: 11 }}>
              {f}
            </Tag>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RadarChartOutlined /> 兄弟股雷达（聚合）
          </h1>
          <p className="text-muted text-sm mt-1">
            一键扫描所有涨停龙头的兄弟股，按「龙头加权聚合分」排序
          </p>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        title="算法说明"
        description="收集涨停池每只龙头的概念/行业 → 跨板块汇聚同概念非涨停股 → 评分=单股兄弟分×(1+龙头加权)。龙头连板越高、共振板块越多，加权越大。聚合分可超过100以体现多重共振强度。"
        className="mb-4"
      />

      <Card variant="borderless" className="mb-4">
        <Form layout="inline">
          <Row gutter={16} style={{ width: "100%" }}>
            <Col>
              <Form.Item label="最低连板数">
                <InputNumber
                  min={1}
                  max={10}
                  value={filters.minBoards}
                  onChange={(v) => setFilters({ ...filters, minBoards: Number(v) || 1 })}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="涨幅上限(%)">
                <InputNumber
                  min={0}
                  max={9}
                  value={filters.maxChange}
                  onChange={(v) => setFilters({ ...filters, maxChange: Number(v) || 5 })}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="返回数量">
                <InputNumber
                  min={10}
                  max={100}
                  value={filters.limit}
                  onChange={(v) => setFilters({ ...filters, limit: Number(v) || 50 })}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={fetchData}
                >
                  开始扫描
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {scanned && data && (
        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card variant="borderless">
              <Statistic
                title="涨停龙头数"
                value={data.totalLimitUp}
                prefix={<RiseOutlined />}
                styles={{ content: { color: "var(--trading-up)" } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless">
              <Statistic
                title="参与板块数"
                value={data.themeCount}
                prefix={<FundOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless">
              <Statistic title="候选股池" value={data.candidateCount} suffix="只" />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless">
              <Statistic
                title="兄弟股入选"
                value={data.cousins.length}
                prefix={<TeamOutlined />}
                suffix="只"
                styles={{ content: { color: "var(--trading-up)" } }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="兄弟股聚合排行" variant="borderless">
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <Spin size="large" />
            <p className="text-muted mt-4">正在跨板块聚合分析，约需 5-15 秒...</p>
          </div>
        ) : !scanned ? (
          <Empty description="点击「开始扫描」启动" />
        ) : !data || data.cousins.length === 0 ? (
          <Empty description="未发现符合条件的兄弟股，可降低连板门槛或放宽涨幅" />
        ) : (
          <Table
            dataSource={data.cousins}
            columns={columns}
            rowKey="code"
            size="small"
            pagination={false}
            scroll={{ x: 1500, y: 600 }}
          />
        )}
      </Card>
    </div>
  )
}

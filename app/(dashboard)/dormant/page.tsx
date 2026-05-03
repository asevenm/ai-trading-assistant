"use client"

import { useEffect, useState } from "react"
import {
  Card,
  Button,
  Spin,
  Table,
  Tag,
  InputNumber,
  Tooltip,
  App,
  Empty,
  Row,
  Col,
  Form,
  Alert,
} from "antd"
import {
  ReloadOutlined,
  MoonOutlined,
  EyeOutlined,
  CheckCircleFilled,
  BellOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import Link from "next/link"

interface DormantStock {
  code: string
  name: string
  price: number
  changePercent: number
  amplitude30d: number
  volumeRatio5to20: number
  distanceToMA20: number
  distanceFrom60dLow: number
  mainNetInflow5d: number
  mainInflowPercent: number
  circulationMarketCap: number
  turnoverRate: number
  volumeRatio: number
  industry: string
  dormantScore: number
  scoreFactors: string[]
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

export default function DormantPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<DormantStock[]>([])
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [watchedCodes, setWatchedCodes] = useState<Set<string>>(new Set())
  const [watchPending, setWatchPending] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    maxMarketCap: 200, // 亿
    maxAmp: 15,
    topN: 30,
  })

  useEffect(() => {
    let cancelled = false
    fetch("/api/dormant/watch")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (Array.isArray(j.watchedCodes)) {
          setWatchedCodes(new Set(j.watchedCodes))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const addWatch = async (stock: DormantStock) => {
    setWatchPending((prev) => new Set(prev).add(stock.code))
    try {
      const res = await fetch("/api/dormant/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: stock.code, name: stock.name }),
      })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setWatchedCodes((prev) => new Set(prev).add(stock.code))
      message.success(
        `已加入「蛰伏股池」${json.stockAdded ? "" : "（已存在）"}，建立 ${json.rulesCreated} 条告警`
      )
    } catch {
      message.error("加入监控失败")
    } finally {
      setWatchPending((prev) => {
        const next = new Set(prev)
        next.delete(stock.code)
        return next
      })
    }
  }

  const removeWatch = async (stock: DormantStock) => {
    setWatchPending((prev) => new Set(prev).add(stock.code))
    try {
      const res = await fetch(`/api/dormant/watch?code=${stock.code}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed")
      setWatchedCodes((prev) => {
        const next = new Set(prev)
        next.delete(stock.code)
        return next
      })
      message.success(`已停止 ${stock.name} 的告警监控`)
    } catch {
      message.error("移除告警失败")
    } finally {
      setWatchPending((prev) => {
        const next = new Set(prev)
        next.delete(stock.code)
        return next
      })
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        maxMarketCap: String(filters.maxMarketCap),
        maxAmp: String(filters.maxAmp),
        topN: String(filters.topN),
      })
      const res = await fetch(`/api/dormant/scan?${params}`)
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setData(json.stocks || [])
      setScanned(true)
      message.success(`扫描完成，发现 ${json.total} 只蛰伏股`)
    } catch {
      message.error("扫描失败")
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnsType<DormantStock> = [
    {
      title: "蛰伏分",
      dataIndex: "dormantScore",
      width: 80,
      align: "center",
      sorter: (a, b) => a.dormantScore - b.dormantScore,
      defaultSortOrder: "descend",
      render: (v: number) => (
        <Tag
          variant="filled"
          color={v >= 70 ? "purple" : v >= 50 ? "magenta" : v >= 30 ? "blue" : "default"}
          style={{ minWidth: 40 }}
        >
          <span className="font-bold">{v}</span>
        </Tag>
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
      title: "今日",
      dataIndex: "changePercent",
      width: 70,
      align: "right",
      render: (v: number) => (
        <span className={v >= 0 ? "text-up" : "text-down"}>
          {v >= 0 ? "+" : ""}
          {v.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "30日振幅",
      dataIndex: "amplitude30d",
      width: 90,
      align: "right",
      sorter: (a, b) => a.amplitude30d - b.amplitude30d,
      render: (v: number) => (
        <Tooltip title="(最高-最低)/均价，越小越蛰伏">
          <span className={v < 8 ? "text-up font-medium" : ""}>{v.toFixed(1)}%</span>
        </Tooltip>
      ),
    },
    {
      title: "5/20量比",
      dataIndex: "volumeRatio5to20",
      width: 90,
      align: "right",
      sorter: (a, b) => a.volumeRatio5to20 - b.volumeRatio5to20,
      render: (v: number) => (
        <Tooltip title="近5日均量/近20日均量，越小越缩量">
          <span className={v < 0.8 ? "text-up font-medium" : v > 1.2 ? "text-down" : ""}>
            {(v * 100).toFixed(0)}%
          </span>
        </Tooltip>
      ),
    },
    {
      title: "距MA20",
      dataIndex: "distanceToMA20",
      width: 80,
      align: "right",
      render: (v: number) => (
        <Tooltip title="贴近MA20说明筹码稳定">
          <span className={Math.abs(v) < 2 ? "text-up font-medium" : ""}>
            {v >= 0 ? "+" : ""}
            {v.toFixed(1)}%
          </span>
        </Tooltip>
      ),
    },
    {
      title: "距60日低",
      dataIndex: "distanceFrom60dLow",
      width: 90,
      align: "right",
      render: (v: number) => `+${v.toFixed(1)}%`,
    },
    {
      title: "主力%",
      dataIndex: "mainInflowPercent",
      width: 80,
      align: "right",
      sorter: (a, b) => a.mainInflowPercent - b.mainInflowPercent,
      render: (v: number) => (
        <span className={v > 0 ? "text-up font-medium" : "text-down"}>
          {v >= 0 ? "+" : ""}
          {v.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "主力净流入",
      dataIndex: "mainNetInflow5d",
      width: 100,
      align: "right",
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
      title: "行业",
      dataIndex: "industry",
      width: 100,
      render: (v: string) => v || "-",
    },
    {
      title: "评分因子",
      dataIndex: "scoreFactors",
      ellipsis: true,
      render: (factors: string[]) => (
        <div className="flex flex-wrap gap-1">
          {factors.map((f, i) => (
            <Tag key={i} variant="filled" color="purple" style={{ fontSize: 11 }}>
              {f}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (_, record) => {
        const isWatched = watchedCodes.has(record.code)
        const isPending = watchPending.has(record.code)
        return isWatched ? (
          <Tooltip title="点击移除告警监控">
            <Button
              size="small"
              type="text"
              icon={<CheckCircleFilled style={{ color: "var(--trading-up)" }} />}
              loading={isPending}
              onClick={() => removeWatch(record)}
            >
              监控中
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title="一键加入「蛰伏股池」+ 自动建立 3 条告警（涨幅突破/逼近涨停/放量）">
            <Button
              size="small"
              type="link"
              icon={<BellOutlined />}
              loading={isPending}
              onClick={() => addWatch(record)}
            >
              加监控
            </Button>
          </Tooltip>
        )
      },
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MoonOutlined /> 蛰伏股扫描
          </h1>
          <p className="text-muted text-sm mt-1">
            横盘 + 缩量 + 贴近均线 + 主力悄悄进场 = 风起前的潜伏期
          </p>
        </div>
        {watchedCodes.size > 0 && (
          <Link href="/alerts">
            <Tag color="purple" variant="filled" style={{ cursor: "pointer", padding: "4px 10px" }}>
              <EyeOutlined /> 监控中 {watchedCodes.size} 只 → 查看告警
            </Tag>
          </Link>
        )}
      </div>

      <Alert
        type="info"
        showIcon
        title="扫描逻辑"
        description="预筛：流通市值上限 + 今日不大动 + 量比<1.5 + 60日内涨跌幅<25% + 主力净流入为正。深度扫描：30日振幅 / 5日vs20日量能 / MA20距离 / 60日低点距离 / 主力净占比，加权打分 0-100。"
        className="mb-4"
      />

      <Card variant="borderless" className="mb-4">
        <Form layout="inline">
          <Row gutter={16} style={{ width: "100%" }}>
            <Col>
              <Form.Item label="流通市值上限(亿)">
                <InputNumber
                  min={10}
                  max={2000}
                  value={filters.maxMarketCap}
                  onChange={(v) =>
                    setFilters({ ...filters, maxMarketCap: Number(v) || 200 })
                  }
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="30日振幅上限(%)">
                <InputNumber
                  min={5}
                  max={30}
                  value={filters.maxAmp}
                  onChange={(v) => setFilters({ ...filters, maxAmp: Number(v) || 15 })}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="返回数量">
                <InputNumber
                  min={5}
                  max={100}
                  value={filters.topN}
                  onChange={(v) => setFilters({ ...filters, topN: Number(v) || 30 })}
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

      <Card
        title={`扫描结果 ${data.length > 0 ? `(${data.length})` : ""}`}
        variant="borderless"
      >
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <Spin size="large" />
            <p className="text-muted mt-4">正在抓取K线深度分析，约需 5-10 秒...</p>
          </div>
        ) : !scanned ? (
          <Empty description="设定参数后点击「开始扫描」" />
        ) : data.length === 0 ? (
          <Empty description="未发现符合条件的蛰伏股，可放宽参数" />
        ) : (
          <Table
            dataSource={data}
            columns={columns}
            rowKey="code"
            size="small"
            pagination={false}
            scroll={{ x: 1400, y: 600 }}
          />
        )}
      </Card>
    </div>
  )
}

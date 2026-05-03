"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
} from "antd"
import {
  AimOutlined,
  ReloadOutlined,
  RocketOutlined,
  SyncOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import Link from "next/link"
import type { PreLimitUpCandidate } from "@/lib/pre-limit-up-api"

const REFRESH_INTERVAL = 30_000 // 30秒自动刷新

export default function PreLimitUpPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<PreLimitUpCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>("")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pre-limit-up", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setData(json.candidates ?? [])
      setLastUpdate(new Date().toLocaleTimeString())
    } catch {
      message.error("扫描失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchData, REFRESH_INTERVAL)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoRefresh, fetchData])

  const columns: ColumnsType<PreLimitUpCandidate> = [
    {
      title: "评分",
      dataIndex: "score",
      width: 90,
      fixed: "left",
      sorter: (a, b) => a.score - b.score,
      defaultSortOrder: "descend",
      render: (v: number) => (
        <div className="w-16">
          <Progress
            percent={v}
            size="small"
            strokeColor={
              v >= 75 ? "var(--trading-up)" : v >= 50 ? "#faad14" : "var(--text-muted)"
            }
            format={(p) => <span className="text-xs">{p}</span>}
          />
        </div>
      ),
    },
    {
      title: "代码",
      dataIndex: "code",
      width: 90,
      render: (code: string) => (
        <Link
          href={`/stock/${code}`}
          className="font-mono text-primary hover:underline"
        >
          {code}
        </Link>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      width: 110,
      render: (name: string, record) => (
        <Link
          href={`/stock/${record.code}`}
          className="font-medium text-primary hover:underline"
        >
          {name}
        </Link>
      ),
    },
    {
      title: "现价",
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
      sorter: (a, b) => a.changePercent - b.changePercent,
      render: (v: number) => (
        <span className="text-up font-medium">+{v.toFixed(2)}%</span>
      ),
    },
    {
      title: "距涨停",
      dataIndex: "distanceToLimit",
      width: 90,
      align: "right",
      sorter: (a, b) => a.distanceToLimit - b.distanceToLimit,
      render: (v: number) => (
        <Tooltip title="当前价距离涨停价还差的百分比">
          <span className={v < 1 ? "text-up font-medium" : ""}>{v.toFixed(2)}%</span>
        </Tooltip>
      ),
    },
    {
      title: "涨速",
      dataIndex: "speed",
      width: 80,
      align: "right",
      sorter: (a, b) => a.speed - b.speed,
      render: (v: number) => (
        <Tooltip title="近1分钟涨幅，反映拉升速度">
          <span className={v >= 1.5 ? "text-up font-medium" : ""}>
            {v >= 0 ? "+" : ""}
            {v.toFixed(2)}%
          </span>
        </Tooltip>
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
      title: "主力流入",
      dataIndex: "mainNetInflow",
      width: 100,
      align: "right",
      sorter: (a, b) => a.mainNetInflow - b.mainNetInflow,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up" : "text-down"}>
          {v >= 0 ? "+" : ""}
          {(v / 1e8).toFixed(2)}亿
        </span>
      ),
    },
    {
      title: "信号",
      dataIndex: "signals",
      width: 240,
      render: (signals: string[]) => (
        <div className="flex flex-wrap gap-1">
          {signals.slice(0, 4).map((s, i) => (
            <Tag key={i} color="blue" variant="filled" className="!m-0 text-xs">
              {s}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "行业",
      dataIndex: "industry",
      width: 100,
      render: (v: string) => v || "-",
    },
  ]

  // 分类统计
  const highScoreCount = data.filter((d) => d.score >= 75).length
  const nearLimitCount = data.filter((d) => d.distanceToLimit < 1).length
  const withMainInflow = data.filter((d) => d.mainNetInflow > 0).length

  if (loading && data.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <RocketOutlined className="text-2xl text-primary" />
          <h1 className="text-2xl font-bold m-0">预涨停雷达</h1>
          {lastUpdate && (
            <span className="text-sm text-muted ml-2">
              最后更新 {lastUpdate}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">自动刷新</span>
            <Switch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              checkedChildren={<SyncOutlined spin />}
            />
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </div>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="候选总数"
              value={data.length}
              suffix="只"
              prefix={<AimOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="高分(≥75)"
              value={highScoreCount}
              suffix="只"
              styles={{ content: { color: "var(--trading-up)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="距涨停<1%"
              value={nearLimitCount}
              suffix="只"
              styles={{ content: { color: "var(--trading-up)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="主力流入"
              value={withMainInflow}
              suffix="只"
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless">
        {data.length === 0 ? (
          <Empty description="暂无符合条件的预涨停股（非交易时段或当前涨幅未到7%+）" />
        ) : (
          <Table
            dataSource={data}
            columns={columns}
            rowKey="code"
            size="small"
            pagination={{ pageSize: 30 }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <Card
        variant="borderless"
        className="mt-4"
        title="打分逻辑说明"
      >
        <div className="text-sm text-muted space-y-1">
          <div>• 距涨停 (25分)：越近越高，1%以内满分</div>
          <div>• 涨速 (25分)：近1分钟涨幅，快速拉升触发</div>
          <div>• 量比 (15分)：&gt;3 满分，反映活跃度</div>
          <div>• 主力净流入 (20分)：大资金吸筹</div>
          <div>• 超大单净流入 (15分)：机构/游资动向</div>
          <div>• 加分：曾触及涨停后开板（回封概率高）+10</div>
          <div>• 减分：流通盘&gt;500亿（大票难封）-10</div>
        </div>
      </Card>
    </div>
  )
}

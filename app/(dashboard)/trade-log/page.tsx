"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, Table, Tag, Empty, Spin, Statistic, Row, Col, Tabs, Button, Modal, App } from "antd"
import {
  BarChartOutlined,
  RobotOutlined,
  CalendarOutlined,
} from "@ant-design/icons"
import { TradeLog, TradePlan, Stock } from "@prisma/client"
import type { ColumnsType } from "antd/es/table"
import dayjs from "dayjs"
import { TradeStatsPanel } from "@/components/trade-log/TradeStatsPanel"
import { MonthlyReportPanel } from "@/components/trade-log/MonthlyReportPanel"

type LogWithRelations = TradeLog & {
  tradePlan: TradePlan & { stock: Stock }
}

interface AiReview {
  entryAnalysis: string
  exitAnalysis: string
  planExecution: string
  score: number
  improvements: string[]
  summary: string
}

export default function TradeLogPage() {
  const { message } = App.useApp()
  const [logs, setLogs] = useState<LogWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewTarget, setReviewTarget] = useState<LogWithRelations | null>(null)
  const [review, setReview] = useState<AiReview | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-logs")
      const data = await res.json()
      setLogs(data)
    } catch {
      console.error("Failed to fetch logs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleAiReview = async (log: LogWithRelations) => {
    setReviewTarget(log)
    setReview(null)
    setReviewing(true)
    try {
      const res = await fetch("/api/trade-logs/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeLogId: log.id }),
      })
      if (!res.ok) throw new Error("Failed")
      setReview(await res.json())
    } catch {
      message.error("AI分析失败")
      setReviewTarget(null)
    } finally {
      setReviewing(false)
    }
  }

  const stats = {
    totalTrades: logs.length,
    buyCount: logs.filter((l) => l.type === "buy").length,
    sellCount: logs.filter((l) => l.type === "sell").length,
    totalPnL: logs.reduce((sum, l) => sum + (l.realizedPnL || 0), 0),
    winCount: logs.filter((l) => l.resultTag === "success").length,
  }

  const winRate =
    stats.sellCount > 0 ? (stats.winCount / stats.sellCount) * 100 : 0

  const columns: ColumnsType<LogWithRelations> = [
    {
      title: "时间",
      dataIndex: "tradeTime",
      key: "tradeTime",
      render: (val) => dayjs(val).format("MM-DD HH:mm"),
      sorter: (a, b) =>
        new Date(a.tradeTime).getTime() - new Date(b.tradeTime).getTime(),
      defaultSortOrder: "descend",
    },
    {
      title: "股票",
      key: "stock",
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.tradePlan.stock.name}</div>
          <div className="text-xs text-muted-foreground">
            {record.tradePlan.stock.code}
          </div>
        </div>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      render: (type) => (
        <Tag color={type === "buy" ? "green" : "red"}>
          {type === "buy" ? "买入" : "卖出"}
        </Tag>
      ),
    },
    {
      title: "数量",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "价格",
      dataIndex: "price",
      key: "price",
      render: (val) => val.toFixed(2),
    },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
      render: (val) => val.toFixed(2),
    },
    {
      title: "盈亏",
      dataIndex: "realizedPnL",
      key: "realizedPnL",
      render: (val) =>
        val ? (
          <span className={val >= 0 ? "text-up" : "text-down"}>
            {val >= 0 ? "+" : ""}
            {val.toFixed(2)}
          </span>
        ) : (
          "-"
        ),
    },
    {
      title: "理由",
      key: "reason",
      render: (_, record) => record.entryReason || record.exitReason || "-",
    },
    {
      title: "结果",
      dataIndex: "resultTag",
      key: "resultTag",
      render: (tag) => {
        if (!tag) return "-"
        const map: Record<string, { label: string; color: string }> = {
          success: { label: "成功", color: "green" },
          failure: { label: "失败", color: "red" },
          partial: { label: "部分", color: "orange" },
        }
        const info = map[tag] || { label: tag, color: "default" }
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_, record) =>
        record.type === "sell" && record.resultTag ? (
          <Button
            size="small"
            icon={<RobotOutlined />}
            onClick={() => handleAiReview(record)}
          >
            AI复盘
          </Button>
        ) : null,
    },
  ]

  const tabItems = [
    {
      key: "logs",
      label: "交易记录",
      children: (
        <div>
          <Row gutter={16} className="mb-6">
            <Col span={6}>
              <Card variant="borderless">
                <Statistic title="总交易次数" value={stats.totalTrades} />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless">
                <Statistic
                  title="买入/卖出"
                  value={`${stats.buyCount}/${stats.sellCount}`}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless">
                <Statistic
                  title="总盈亏"
                  value={stats.totalPnL}
                  precision={2}
                  styles={{
                    content: {
                      color:
                        stats.totalPnL >= 0
                          ? "var(--trading-up)"
                          : "var(--trading-down)",
                    },
                  }}
                  prefix={stats.totalPnL >= 0 ? "+" : ""}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless">
                <Statistic
                  title="胜率"
                  value={winRate}
                  precision={1}
                  suffix="%"
                  styles={{
                    content: {
                      color:
                        winRate >= 50
                          ? "var(--trading-up)"
                          : "var(--trading-down)",
                    },
                  }}
                />
              </Card>
            </Col>
          </Row>

          <Card variant="borderless">
            {loading ? (
              <div className="flex justify-center py-16">
                <Spin size="large" />
              </div>
            ) : logs.length === 0 ? (
              <Empty description="暂无交易记录" className="py-16" />
            ) : (
              <Table
                dataSource={logs}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 20 }}
              />
            )}
          </Card>
        </div>
      ),
    },
    {
      key: "stats",
      label: (
        <span>
          <BarChartOutlined className="mr-1" />
          策略统计
        </span>
      ),
      children: <TradeStatsPanel />,
    },
    {
      key: "monthly",
      label: (
        <span>
          <CalendarOutlined className="mr-1" />
          月度报告
        </span>
      ),
      children: <MonthlyReportPanel />,
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">交易日志</h1>

      <Tabs items={tabItems} defaultActiveKey="logs" />

      {/* AI Review Modal */}
      <Modal
        title={
          reviewTarget
            ? `AI复盘 — ${reviewTarget.tradePlan.stock.name}(${reviewTarget.tradePlan.stock.code})`
            : "AI复盘"
        }
        open={!!reviewTarget}
        onCancel={() => setReviewTarget(null)}
        footer={null}
        width={640}
      >
        {reviewing ? (
          <div className="flex flex-col items-center py-12">
            <Spin size="large" />
            <div className="mt-4 text-muted-foreground">AI正在分析交易...</div>
          </div>
        ) : review ? (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold" style={{
                color: review.score >= 70 ? "var(--trading-up)" : review.score >= 40 ? "#faad14" : "var(--trading-down)",
              }}>
                {review.score}
              </div>
              <div className="text-sm text-muted-foreground">交易评分</div>
            </div>

            <Card size="small" title="总结" variant="borderless">
              <p>{review.summary}</p>
            </Card>

            <Card size="small" title="买入分析" variant="borderless">
              <p>{review.entryAnalysis}</p>
            </Card>

            <Card size="small" title="卖出分析" variant="borderless">
              <p>{review.exitAnalysis}</p>
            </Card>

            <Card size="small" title="计划执行" variant="borderless">
              <p>{review.planExecution}</p>
            </Card>

            <Card size="small" title="改进建议" variant="borderless">
              <div className="space-y-1">
                {review.improvements.map((imp, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

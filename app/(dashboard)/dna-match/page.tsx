"use client"

import { useState } from "react"
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Spin,
  Statistic,
  Table,
  Tooltip,
} from "antd"
import { ExperimentOutlined, SearchOutlined } from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import Link from "next/link"
import type { DnaMatch, DnaMatchResult } from "@/lib/dna-similarity"

export default function DnaMatchPage() {
  const { message } = App.useApp()
  const [result, setResult] = useState<DnaMatchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleSearch = async (values: {
    targetCode: string
    windowDays: number
    futureDays: number
  }) => {
    setLoading(true)
    try {
      const res = await fetch("/api/dna-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (!res.ok) {
        message.error(json.error ?? "匹配失败")
        return
      }
      setResult(json)
      if (json.matches.length === 0) {
        message.info("未找到相似度≥85%的匹配，尝试扩大窗口或换股票")
      } else {
        message.success(`找到 ${json.matches.length} 个相似案例`)
      }
    } catch {
      message.error("请求失败")
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnsType<DnaMatch> = [
    {
      title: "相似度",
      dataIndex: "similarity",
      width: 120,
      sorter: (a, b) => a.similarity - b.similarity,
      defaultSortOrder: "descend",
      render: (v: number) => (
        <Progress
          percent={Math.round(v * 100)}
          size="small"
          strokeColor="var(--trading-up)"
        />
      ),
    },
    {
      title: "股票",
      dataIndex: "code",
      width: 150,
      render: (code: string, record) => (
        <Link href={`/stock/${code}`} className="text-primary hover:underline">
          <span className="font-medium">{record.name}</span>{" "}
          <span className="font-mono text-xs">({code})</span>
        </Link>
      ),
    },
    {
      title: "匹配时段",
      width: 200,
      render: (_v, r) => (
        <span className="font-mono text-xs">
          {r.matchStartDate} → {r.matchEndDate}
        </span>
      ),
    },
    {
      title: "3日",
      dataIndex: ["futurePerformance", "day3"],
      width: 80,
      align: "right",
      sorter: (a, b) => (a.futurePerformance?.day3 ?? 0) - (b.futurePerformance?.day3 ?? 0),
      render: (_v, r) => renderReturn(r.futurePerformance?.day3),
    },
    {
      title: "5日",
      dataIndex: ["futurePerformance", "day5"],
      width: 80,
      align: "right",
      render: (_v, r) => renderReturn(r.futurePerformance?.day5),
    },
    {
      title: "10日",
      dataIndex: ["futurePerformance", "day10"],
      width: 80,
      align: "right",
      render: (_v, r) => renderReturn(r.futurePerformance?.day10),
    },
    {
      title: "20日",
      dataIndex: ["futurePerformance", "day20"],
      width: 80,
      align: "right",
      render: (_v, r) => renderReturn(r.futurePerformance?.day20),
    },
    {
      title: "最大涨幅",
      dataIndex: ["futurePerformance", "maxGain"],
      width: 90,
      align: "right",
      render: (_v, r) => (
        <Tooltip title="窗口末后20天内最大涨幅">
          <span className="text-up">+{(r.futurePerformance?.maxGain ?? 0).toFixed(1)}%</span>
        </Tooltip>
      ),
    },
    {
      title: "最大回撤",
      dataIndex: ["futurePerformance", "maxDrawdown"],
      width: 90,
      align: "right",
      render: (_v, r) => (
        <span className="text-down">
          {(r.futurePerformance?.maxDrawdown ?? 0).toFixed(1)}%
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <ExperimentOutlined className="text-2xl text-primary" />
        <h1 className="text-2xl font-bold m-0">妖股DNA · K线相似匹配</h1>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card variant="borderless" title="输入参数">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSearch}
              initialValues={{ windowDays: 30, futureDays: 10 }}
            >
              <Form.Item
                label="目标股票代码"
                name="targetCode"
                rules={[{ required: true, pattern: /^\d{6}$/, message: "6位代码" }]}
              >
                <Input placeholder="例如 600519" />
              </Form.Item>
              <Form.Item
                label="对比窗口（交易日）"
                name="windowDays"
                rules={[{ required: true, type: "number", min: 10, max: 90 }]}
              >
                <InputNumber className="!w-full" min={10} max={90} />
              </Form.Item>
              <Form.Item
                label="未来观察期（交易日）"
                name="futureDays"
                rules={[{ required: true, type: "number", min: 3, max: 20 }]}
              >
                <InputNumber className="!w-full" min={3} max={20} />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
                loading={loading}
                block
              >
                搜索相似案例
              </Button>
            </Form>
            <div className="mt-4 text-xs text-muted space-y-1">
              <div>• 候选池：自选股 + 近期涨幅Top50</div>
              <div>• 算法：价格相似度 70% + 量能相似度 30%</div>
              <div>• 阈值：相似度 ≥ 85% 才入选</div>
              <div>• 未来收益 = 匹配段结束日 → 之后 N 日</div>
            </div>
          </Card>
        </Col>
        <Col span={16}>
          {loading ? (
            <Card variant="borderless">
              <div className="flex flex-col items-center py-16">
                <Spin size="large" />
                <div className="mt-4 text-muted">正在扫描候选池并计算相似度...</div>
              </div>
            </Card>
          ) : result ? (
            <>
              <Row gutter={16} className="mb-4">
                <Col span={6}>
                  <Card variant="borderless">
                    <Statistic
                      title="匹配数"
                      value={result.aggregateStats.totalMatches}
                      suffix="个"
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card variant="borderless">
                    <Statistic
                      title="平均5日收益"
                      value={result.aggregateStats.avgDay5}
                      precision={2}
                      suffix="%"
                      styles={{
                        content: {
                          color:
                            result.aggregateStats.avgDay5 >= 0
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
                      title="5日胜率"
                      value={result.aggregateStats.winRateDay5}
                      precision={0}
                      suffix="%"
                      styles={{
                        content: {
                          color:
                            result.aggregateStats.winRateDay5 >= 50
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
                      title="10日胜率"
                      value={result.aggregateStats.winRateDay10}
                      precision={0}
                      suffix="%"
                    />
                  </Card>
                </Col>
              </Row>

              <Card
                variant="borderless"
                title={
                  result.target.code ? (
                    <div>
                      <Link
                        href={`/stock/${result.target.code}`}
                        className="text-primary hover:underline"
                      >
                        {result.target.name} ({result.target.code})
                      </Link>{" "}
                      <span className="text-sm text-muted ml-2">
                        当前窗口 {result.target.windowStart} → {result.target.windowEnd}
                      </span>
                    </div>
                  ) : (
                    "相似案例"
                  )
                }
              >
                {result.matches.length > 0 ? (
                  <Table
                    dataSource={result.matches}
                    columns={columns}
                    rowKey={(r) => `${r.code}-${r.matchStartDate}`}
                    size="small"
                    pagination={false}
                    scroll={{ x: 1000 }}
                  />
                ) : (
                  <Empty description="未找到相似度足够高的案例" />
                )}
              </Card>
            </>
          ) : (
            <Card variant="borderless">
              <Empty description="输入目标股票代码开始搜索" />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}

function renderReturn(v: number | undefined): React.ReactNode {
  if (v === undefined || v === null) return "-"
  const color = v >= 0 ? "text-up" : "text-down"
  return (
    <span className={color}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(2)}%
    </span>
  )
}

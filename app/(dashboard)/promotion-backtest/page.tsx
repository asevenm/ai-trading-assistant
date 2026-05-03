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
  Progress,
  Tabs,
} from "antd"
import {
  ReloadOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"

interface BucketStats {
  level: "low" | "medium" | "high" | "veryHigh"
  lowerBound: number
  upperBound: number
  count: number
  avgPredicted: number
  actualHitRate: number
  calibrationError: number
}

interface BoardLevelStats {
  boards: number
  count: number
  promotedCount: number
  hitRate: number
  avgPredicted: number
}

interface BacktestSample {
  date: string
  nextDate: string
  code: string
  name: string
  consecutiveBoards: number
  predictedProbability: number
  predictedLevel: BucketStats["level"]
  promoted: boolean
  nextDayBoards: number | null
}

interface BacktestReport {
  fromDate: string
  toDate: string
  tradingDays: number
  totalSamples: number
  overallHitRate: number
  buckets: BucketStats[]
  byBoardLevel: BoardLevelStats[]
  weightedCalibrationError: number
  samples: BacktestSample[]
}

const levelLabels: Record<BucketStats["level"], string> = {
  veryHigh: "极高",
  high: "高",
  medium: "中",
  low: "低",
}

const levelColors: Record<BucketStats["level"], string> = {
  veryHigh: "red",
  high: "orange",
  medium: "blue",
  low: "default",
}

export default function PromotionBacktestPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<BacktestReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(20)
  const [maxPerDay, setMaxPerDay] = useState(100)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        days: String(days),
        maxPerDay: String(maxPerDay),
      })
      const res = await fetch(`/api/limit-up/promotion-backtest?${params}`)
      if (!res.ok) throw new Error("Failed")
      const json: BacktestReport = await res.json()
      setData(json)
      message.success(
        `回测完成：${json.tradingDays} 个交易日 / ${json.totalSamples} 样本`
      )
    } catch {
      message.error("回测失败")
    } finally {
      setLoading(false)
    }
  }

  const bucketColumns: ColumnsType<BucketStats> = [
    {
      title: "等级",
      dataIndex: "level",
      width: 100,
      render: (l: BucketStats["level"]) => (
        <Tag variant="filled" color={levelColors[l]}>
          {levelLabels[l]}
        </Tag>
      ),
    },
    {
      title: "概率区间",
      key: "range",
      width: 120,
      render: (_, r) => `${r.lowerBound} - ${r.upperBound}`,
    },
    {
      title: "样本数",
      dataIndex: "count",
      width: 90,
      align: "right",
    },
    {
      title: "模型平均预测",
      dataIndex: "avgPredicted",
      width: 130,
      align: "right",
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: "实际命中率",
      dataIndex: "actualHitRate",
      width: 130,
      align: "right",
      render: (v: number, r) => (
        <span className={v >= r.avgPredicted ? "text-up font-medium" : "text-down font-medium"}>
          {v.toFixed(1)}%
        </span>
      ),
    },
    {
      title: "校准误差",
      dataIndex: "calibrationError",
      width: 200,
      render: (v: number) => (
        <div className="flex items-center gap-2">
          <Progress
            percent={Math.min(100, v)}
            size="small"
            strokeColor={v < 5 ? "#52c41a" : v < 15 ? "#faad14" : "#f5222d"}
            showInfo={false}
            style={{ flex: 1 }}
          />
          <span className="text-sm" style={{ minWidth: 50 }}>
            {v.toFixed(1)}%
          </span>
        </div>
      ),
    },
    {
      title: "建议",
      key: "advice",
      render: (_, r) => {
        if (r.count < 5) return <span className="text-muted">样本不足</span>
        if (r.actualHitRate > r.avgPredicted + 10) {
          return <Tag color="green" variant="filled">低估，可加分</Tag>
        }
        if (r.actualHitRate < r.avgPredicted - 10) {
          return <Tag color="red" variant="filled">高估，需降权</Tag>
        }
        return <Tag color="cyan" variant="filled">校准良好</Tag>
      },
    },
  ]

  const boardColumns: ColumnsType<BoardLevelStats> = [
    {
      title: "连板数",
      dataIndex: "boards",
      width: 90,
      render: (v: number) => (
        <Tag variant="filled" color={v >= 4 ? "purple" : v >= 2 ? "magenta" : "blue"}>
          {v}板
        </Tag>
      ),
    },
    {
      title: "样本数",
      dataIndex: "count",
      width: 90,
      align: "right",
    },
    {
      title: "进阶数",
      dataIndex: "promotedCount",
      width: 90,
      align: "right",
    },
    {
      title: "实际进阶率",
      dataIndex: "hitRate",
      width: 130,
      align: "right",
      render: (v: number) => (
        <span className="text-up font-medium">{v.toFixed(1)}%</span>
      ),
    },
    {
      title: "模型平均预测",
      dataIndex: "avgPredicted",
      width: 130,
      align: "right",
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: "偏差",
      key: "bias",
      width: 130,
      render: (_, r) => {
        const bias = r.avgPredicted - r.hitRate
        return (
          <span className={bias > 5 ? "text-down" : bias < -5 ? "text-up" : ""}>
            {bias >= 0 ? "+" : ""}
            {bias.toFixed(1)}%
          </span>
        )
      },
    },
  ]

  const sampleColumns: ColumnsType<BacktestSample> = [
    { title: "日期", dataIndex: "date", width: 90 },
    { title: "代码", dataIndex: "code", width: 80 },
    { title: "名称", dataIndex: "name", width: 100 },
    {
      title: "板位",
      dataIndex: "consecutiveBoards",
      width: 70,
      render: (v: number) => `${v}板`,
    },
    {
      title: "预测",
      dataIndex: "predictedProbability",
      width: 80,
      align: "right",
      render: (v: number, r) => (
        <Tag variant="filled" color={levelColors[r.predictedLevel]}>{v}</Tag>
      ),
    },
    {
      title: "结果",
      dataIndex: "promoted",
      width: 90,
      align: "center",
      render: (v: boolean, r) =>
        v ? (
          <Tag variant="filled" color="green">
            <CheckCircleOutlined /> 进阶 {r.nextDayBoards}板
          </Tag>
        ) : (
          <Tag variant="filled" color="default">
            未进阶
          </Tag>
        ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ExperimentOutlined /> 进阶概率回测
          </h1>
          <p className="text-muted text-sm mt-1">
            用历史涨停数据校准评分模型 - 看看哪个等级「言而有信」
          </p>
        </div>
      </div>

      <Alert
        type="warning"
        showIcon
        title="回测局限"
        description="历史模式下，板块强度（依赖当时板块流向）和封单/流通市值（依赖当时市值）暂未参与评分；其余维度全部生效。因此预测概率会偏低，但等级排序的相对关系仍可校准。"
        className="mb-4"
      />

      <Card variant="borderless" className="mb-4">
        <Form layout="inline">
          <Row gutter={16} style={{ width: "100%" }}>
            <Col>
              <Form.Item label="回测交易日">
                <InputNumber
                  min={3}
                  max={60}
                  value={days}
                  onChange={(v) => setDays(Number(v) || 20)}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="每日最多样本">
                <InputNumber
                  min={20}
                  max={200}
                  step={10}
                  value={maxPerDay}
                  onChange={(v) => setMaxPerDay(Number(v) || 100)}
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
                  开始回测
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {data && (
        <>
          <Row gutter={16} className="mb-4">
            <Col span={6}>
              <Card variant="borderless">
                <Statistic
                  title="回测窗口"
                  value={`${data.fromDate} → ${data.toDate}`}
                  formatter={(v) => <span style={{ fontSize: 16 }}>{v}</span>}
                />
                <p className="text-muted text-xs mt-1">{data.tradingDays} 个交易日</p>
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless">
                <Statistic title="样本总数" value={data.totalSamples} suffix="只" />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless">
                <Statistic
                  title="整体进阶率"
                  value={data.overallHitRate}
                  precision={1}
                  suffix="%"
                  styles={{ content: { color: "var(--trading-up)" } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless">
                <Statistic
                  title="加权校准误差"
                  value={data.weightedCalibrationError}
                  precision={1}
                  suffix="%"
                  prefix={<WarningOutlined />}
                  styles={{
                    content: {
                      color:
                        data.weightedCalibrationError < 5
                          ? "var(--trading-up)"
                          : data.weightedCalibrationError < 15
                            ? "#faad14"
                            : "var(--trading-down)",
                    },
                  }}
                />
              </Card>
            </Col>
          </Row>

          <Tabs
            defaultActiveKey="bucket"
            items={[
              {
                key: "bucket",
                label: "等级校准",
                children: (
                  <Card variant="borderless">
                    <Table
                      dataSource={data.buckets}
                      columns={bucketColumns}
                      rowKey="level"
                      pagination={false}
                      size="small"
                    />
                  </Card>
                ),
              },
              {
                key: "boards",
                label: "按连板数",
                children: (
                  <Card variant="borderless">
                    <Table
                      dataSource={data.byBoardLevel}
                      columns={boardColumns}
                      rowKey="boards"
                      pagination={false}
                      size="small"
                    />
                  </Card>
                ),
              },
              {
                key: "samples",
                label: `样本明细 (${data.samples.length})`,
                children: (
                  <Card variant="borderless">
                    <Table
                      dataSource={data.samples}
                      columns={sampleColumns}
                      rowKey={(r) => `${r.date}-${r.code}`}
                      pagination={{ pageSize: 50, showSizeChanger: true }}
                      size="small"
                      scroll={{ y: 500 }}
                    />
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}

      {!data && !loading && (
        <Empty description="设定参数后点击「开始回测」（约需 20-40 秒）" />
      )}
      {loading && (
        <div className="flex flex-col items-center py-16">
          <Spin size="large" />
          <p className="text-muted mt-4">
            正在抓取近 {days} 个交易日涨停池数据，约需 20-40 秒...
          </p>
        </div>
      )}
    </div>
  )
}

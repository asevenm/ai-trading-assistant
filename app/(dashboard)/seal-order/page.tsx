"use client"

import { useCallback, useEffect, useState } from "react"
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from "antd"
import {
  CalculatorOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import Link from "next/link"
import type { SealOrderStock, LimitUpCalcResult } from "@/lib/seal-order-api"

const RISK_COLOR: Record<SealOrderStock["bustRiskLevel"], string> = {
  low: "green",
  medium: "blue",
  high: "orange",
  critical: "red",
}
const RISK_LABEL: Record<SealOrderStock["bustRiskLevel"], string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "极度风险",
}

export default function SealOrderPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<SealOrderStock[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/seal-order/ranking", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setData(json.ranking ?? [])
    } catch {
      message.error("加载封单数据失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ColumnsType<SealOrderStock> = [
    {
      title: "代码",
      dataIndex: "code",
      width: 90,
      fixed: "left",
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
      title: "连板",
      dataIndex: "consecutiveBoards",
      width: 70,
      align: "center",
      sorter: (a, b) => a.consecutiveBoards - b.consecutiveBoards,
      render: (v: number) => (
        <Tag color={v >= 4 ? "red" : v >= 2 ? "orange" : "blue"} variant="filled">
          {v}板
        </Tag>
      ),
    },
    {
      title: "封单金额",
      dataIndex: "sealAmount",
      width: 110,
      align: "right",
      sorter: (a, b) => a.sealAmount - b.sealAmount,
      defaultSortOrder: "descend",
      render: (v: number) => (
        <span className={v > 5e8 ? "text-up font-medium" : ""}>
          {(v / 1e8).toFixed(2)}亿
        </span>
      ),
    },
    {
      title: "封单/流通",
      dataIndex: "sealRatio",
      width: 100,
      align: "right",
      sorter: (a, b) => a.sealRatio - b.sealRatio,
      render: (v: number) => (
        <Tooltip title="封单金额占流通市值比例，>3% 为封单较厚">
          <span className={v >= 3 ? "text-up" : v < 1 ? "text-down" : ""}>
            {v.toFixed(2)}%
          </span>
        </Tooltip>
      ),
    },
    {
      title: "炸板次数",
      dataIndex: "bustCount",
      width: 90,
      align: "center",
      sorter: (a, b) => a.bustCount - b.bustCount,
      render: (v: number) =>
        v > 0 ? (
          <Tag color="red" variant="filled">
            炸{v}次
          </Tag>
        ) : (
          <Tag color="green" variant="filled">
            未炸
          </Tag>
        ),
    },
    {
      title: "首封时间",
      dataIndex: "firstSealTime",
      width: 90,
      align: "center",
    },
    {
      title: "换手",
      dataIndex: "turnoverRate",
      width: 80,
      align: "right",
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: "炸板风险",
      dataIndex: "bustProbability",
      width: 200,
      sorter: (a, b) => a.bustProbability - b.bustProbability,
      render: (_v: number, record) => (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag color={RISK_COLOR[record.bustRiskLevel]} variant="filled">
              {RISK_LABEL[record.bustRiskLevel]}
            </Tag>
            <span className="text-xs text-muted">{record.bustProbability}分</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {record.bustFactors.slice(0, 3).map((f, i) => (
              <span key={i} className="text-xs text-muted">
                · {f}
              </span>
            ))}
          </div>
        </div>
      ),
    },
  ]

  const tabs = [
    {
      key: "ranking",
      label: "封单强度排行",
      children: (
        <Card variant="borderless">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spin size="large" />
            </div>
          ) : data.length === 0 ? (
            <Empty description="暂无涨停数据" />
          ) : (
            <Table
              dataSource={data}
              columns={columns}
              rowKey="code"
              size="small"
              pagination={{ pageSize: 30 }}
              scroll={{ x: 1100 }}
            />
          )}
        </Card>
      ),
    },
    {
      key: "calculator",
      label: (
        <span>
          <CalculatorOutlined /> 打板计算器
        </span>
      ),
      children: <CalculatorPanel />,
    },
  ]

  const highRiskCount = data.filter((d) => d.bustRiskLevel === "critical" || d.bustRiskLevel === "high").length
  const thickSealCount = data.filter((d) => d.sealRatio >= 3).length

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <SafetyCertificateOutlined className="text-2xl text-primary" />
          <h1 className="text-2xl font-bold m-0">封单监控 & 打板工具</h1>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card variant="borderless">
            <Statistic title="涨停总数" value={data.length} suffix="只" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="封单厚(≥3%)"
              value={thickSealCount}
              suffix="只"
              styles={{ content: { color: "var(--trading-up)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="高炸板风险"
              value={highRiskCount}
              suffix="只"
              prefix={<WarningOutlined />}
              styles={{ content: { color: "var(--trading-down)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="总封单金额"
              value={data.reduce((m, d) => m + d.sealAmount, 0) / 1e8}
              precision={1}
              suffix="亿"
            />
          </Card>
        </Col>
      </Row>

      <Tabs items={tabs} />
    </div>
  )
}

// ==================== 打板计算器 ====================

function CalculatorPanel() {
  const { message } = App.useApp()
  const [result, setResult] = useState<LimitUpCalcResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleCalculate = async (values: { code: string; fundAmount: number }) => {
    setLoading(true)
    try {
      const res = await fetch("/api/seal-order/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (!res.ok) {
        message.error(json.error ?? "计算失败")
        setResult(null)
        return
      }
      setResult(json)
    } catch {
      message.error("计算失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Row gutter={16}>
      <Col span={10}>
        <Card variant="borderless" title="输入打板参数">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCalculate}
            initialValues={{ fundAmount: 50000 }}
          >
            <Form.Item
              label="股票代码"
              name="code"
              rules={[{ required: true, pattern: /^\d{6}$/, message: "6位代码" }]}
            >
              <Input placeholder="例如 000001" />
            </Form.Item>
            <Form.Item
              label="打板资金（元）"
              name="fundAmount"
              rules={[{ required: true, type: "number", min: 1000 }]}
            >
              <InputNumber<number>
                className="!w-full"
                step={10000}
                min={1000}
                formatter={(v) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(v) => Number((v ?? "").replace(/\¥\s?|(,*)/g, ""))}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              计算
            </Button>
          </Form>
          <div className="mt-4 text-xs text-muted">
            <div>• 仅支持今日已涨停的股票</div>
            <div>• 排队位置为估算，不考虑撤单和量化高频抢单</div>
            <div>• 计算结果仅供参考，不构成投资建议</div>
          </div>
        </Card>
      </Col>
      <Col span={14}>
        <Card variant="borderless" title="计算结果">
          {result ? (
            <div>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="股票">
                  <span className="font-medium">
                    {result.name} ({result.code})
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="涨停价">
                  <span className="text-up font-medium">¥{result.limitPrice.toFixed(2)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="现价">¥{result.currentPrice.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="当前封单">
                  {(result.sealAmount / 1e8).toFixed(2)} 亿
                </Descriptions.Item>
                <Descriptions.Item label="可买股数">
                  {result.buyableShares.toLocaleString()} 股
                </Descriptions.Item>
                <Descriptions.Item label="实际成本">
                  ¥{result.estimatedCost.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="排队位置" span={2}>
                  <div className="flex items-center gap-2">
                    <Progress
                      percent={result.queuePositionPercent}
                      size="small"
                      className="flex-1"
                      strokeColor={
                        result.queuePositionPercent < 50
                          ? "var(--trading-up)"
                          : result.queuePositionPercent < 80
                            ? "#faad14"
                            : "var(--trading-down)"
                      }
                    />
                    <span className="text-xs">
                      你的单约排 {result.queuePositionPercent.toFixed(0)}% 之后
                    </span>
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="打板成功率" span={2}>
                  <Tag
                    color={
                      result.successProbability === "高"
                        ? "green"
                        : result.successProbability === "中"
                          ? "blue"
                          : "red"
                    }
                    variant="filled"
                  >
                    {result.successProbability}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
              <Card variant="borderless" className="mt-4 bg-muted/20">
                <div className="text-sm">{result.suggestion}</div>
              </Card>
            </div>
          ) : (
            <Empty description="请输入参数计算" />
          )}
        </Card>
      </Col>
    </Row>
  )
}

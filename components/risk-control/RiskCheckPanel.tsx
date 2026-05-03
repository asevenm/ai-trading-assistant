"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Card,
  Spin,
  Tag,
  Progress,
  Statistic,
  Row,
  Col,
  Alert,
  Button,
  App,
} from "antd"
import {
  SafetyCertificateOutlined,
  WarningOutlined,
  ReloadOutlined,
} from "@ant-design/icons"

interface PositionItem {
  stockCode: string
  stockName: string
  quantity: number
  avgPrice: number
  amount: number
  positionPercent: number
  breached: boolean
}

interface RiskCheckData {
  dailyPnL: number
  dailyPnLPercent: number
  dailyLossBreached: boolean
  consecutiveLosses: number
  consecutiveLossBreached: boolean
  totalPositionAmount: number
  totalPositionPercent: number
  totalPositionBreached: boolean
  positions: PositionItem[]
  positionBreaches: string[]
  todayTradeCount: number
  warnings: string[]
}

export function RiskCheckPanel() {
  const { message } = App.useApp()
  const [data, setData] = useState<RiskCheckData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCheck = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/risk-control/check")
      if (!res.ok) {
        if (res.status === 400) {
          setData(null)
          return
        }
        throw new Error("Failed")
      }
      setData(await res.json())
    } catch {
      message.error("风控检查失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchCheck()
  }, [fetchCheck])

  if (loading) {
    return (
      <Card variant="borderless">
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card variant="borderless">
        <div className="text-center text-muted-foreground py-8">
          请先配置风控参数
        </div>
      </Card>
    )
  }

  const hasWarnings = data.warnings.length > 0

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-2">
          {data.warnings.map((w, i) => (
            <Alert
              key={i}
              title={w}
              type="error"
              showIcon
              icon={<WarningOutlined />}
            />
          ))}
        </div>
      )}

      {/* Risk Status */}
      <Card
        title={
          <span>
            <SafetyCertificateOutlined className="mr-2" />
            风控状态
            {!hasWarnings && (
              <Tag color="green" className="ml-2">正常</Tag>
            )}
            {hasWarnings && (
              <Tag color="red" className="ml-2">预警</Tag>
            )}
          </span>
        }
        variant="borderless"
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={fetchCheck}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Statistic
              title="今日盈亏"
              value={data.dailyPnL}
              precision={2}
              prefix={data.dailyPnL >= 0 ? "+" : ""}
              styles={{
                content: {
                  color: data.dailyLossBreached
                    ? "#f5222d"
                    : data.dailyPnL >= 0
                      ? "var(--trading-up)"
                      : "var(--trading-down)",
                  fontSize: 18,
                },
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="今日盈亏比"
              value={data.dailyPnLPercent}
              precision={2}
              suffix="%"
              prefix={data.dailyPnLPercent >= 0 ? "+" : ""}
              styles={{
                content: {
                  color: data.dailyLossBreached
                    ? "#f5222d"
                    : data.dailyPnLPercent >= 0
                      ? "var(--trading-up)"
                      : "var(--trading-down)",
                  fontSize: 18,
                },
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="连续亏损"
              value={data.consecutiveLosses}
              suffix="次"
              styles={{
                content: {
                  color: data.consecutiveLossBreached ? "#f5222d" : undefined,
                  fontSize: 18,
                },
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="今日交易"
              value={data.todayTradeCount}
              suffix="笔"
              styles={{ content: { fontSize: 18 } }}
            />
          </Col>
        </Row>

        {/* Position Overview */}
        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">总仓位使用</div>
          <Progress
            percent={Math.min(data.totalPositionPercent, 100)}
            strokeColor={data.totalPositionBreached ? "#f5222d" : "#1890ff"}
            format={() => `${data.totalPositionPercent.toFixed(1)}%`}
          />
        </div>

        {/* Individual Positions */}
        {data.positions.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">持仓明细</div>
            <div className="space-y-2">
              {data.positions.map((pos) => (
                <div
                  key={pos.stockCode}
                  className={`flex items-center justify-between p-2 rounded ${
                    pos.breached ? "bg-red-500/10 border border-red-500/20" : "bg-white/5"
                  }`}
                >
                  <div>
                    <span className="font-medium">{pos.stockName}</span>
                    <span className="text-xs text-muted-foreground ml-2">{pos.stockCode}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{pos.quantity}股</span>
                    <span>均价 {pos.avgPrice.toFixed(2)}</span>
                    <span>市值 {pos.amount.toFixed(0)}元</span>
                    <Tag color={pos.breached ? "red" : "blue"}>
                      {pos.positionPercent.toFixed(1)}%
                    </Tag>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.positions.length === 0 && (
          <div className="text-center text-muted-foreground py-4">
            暂无持仓记录
          </div>
        )}
      </Card>
    </div>
  )
}

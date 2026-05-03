"use client"

import { Card, Statistic, Col, Row } from "antd"
import type { NorthboundFlow } from "@/lib/market-api"

interface NorthboundCardProps {
  data: NorthboundFlow | null
}

export function NorthboundCard({ data }: NorthboundCardProps) {
  if (!data) {
    return (
      <Card title="北向资金" size="small" variant="borderless">
        <div className="text-center text-muted-foreground py-4">暂无数据</div>
      </Card>
    )
  }

  const formatAmount = (val: number) => (val / 1e8).toFixed(2)
  const isPositive = (val: number) => val >= 0

  return (
    <Card title="北向资金" size="small" variant="borderless">
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Statistic
            title="沪股通净买入"
            value={formatAmount(data.shNet)}
            suffix="亿"
            styles={{ content: {
              color: isPositive(data.shNet)
                ? "var(--trading-up)"
                : "var(--trading-down)",
            } }}
            prefix={isPositive(data.shNet) ? "+" : ""}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="深股通净买入"
            value={formatAmount(data.szNet)}
            suffix="亿"
            styles={{ content: {
              color: isPositive(data.szNet)
                ? "var(--trading-up)"
                : "var(--trading-down)",
            } }}
            prefix={isPositive(data.szNet) ? "+" : ""}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="合计净买入"
            value={formatAmount(data.totalNet)}
            suffix="亿"
            styles={{ content: {
              color: isPositive(data.totalNet)
                ? "var(--trading-up)"
                : "var(--trading-down)",
              fontWeight: "bold",
            } }}
            prefix={isPositive(data.totalNet) ? "+" : ""}
          />
        </Col>
      </Row>
    </Card>
  )
}

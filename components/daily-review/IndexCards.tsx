"use client"

import { Card, Col, Row, Statistic } from "antd"
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons"
import type { MarketIndex } from "@/lib/market-api"

interface IndexCardsProps {
  indices: MarketIndex[]
}

export function IndexCards({ indices }: IndexCardsProps) {
  return (
    <Row gutter={[16, 16]}>
      {indices.map((index) => {
        const isUp = index.changePercent >= 0
        return (
          <Col key={index.code} xs={12} sm={12} md={6}>
            <Card size="small" variant="borderless">
              <Statistic
                title={index.name}
                value={index.price}
                precision={2}
                styles={{ content: {
                  color: isUp ? "var(--trading-up)" : "var(--trading-down)",
                  fontSize: 20,
                } }}
                prefix={isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                suffix={
                  <span className="text-sm">
                    {isUp ? "+" : ""}
                    {index.changePercent.toFixed(2)}%
                  </span>
                }
              />
            </Card>
          </Col>
        )
      })}
    </Row>
  )
}

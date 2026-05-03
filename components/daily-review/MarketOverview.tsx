"use client"

import { Card, Col, Row, Statistic } from "antd"
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  PauseOutlined,
} from "@ant-design/icons"
import type { MarketStats } from "@/lib/market-api"

interface MarketOverviewProps {
  stats: MarketStats
}

export function MarketOverview({ stats }: MarketOverviewProps) {
  return (
    <Card title="涨跌统计" size="small" variant="borderless">
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Statistic
            title="上涨"
            value={stats.upCount}
            styles={{ content: { color: "var(--trading-up)" } }}
            prefix={<ArrowUpOutlined />}
            suffix="家"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="下跌"
            value={stats.downCount}
            styles={{ content: { color: "var(--trading-down)" } }}
            prefix={<ArrowDownOutlined />}
            suffix="家"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="平盘"
            value={stats.flatCount}
            styles={{ content: { color: "var(--text-muted)" } }}
            prefix={<PauseOutlined />}
            suffix="家"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="涨停"
            value={stats.limitUpCount}
            styles={{ content: { color: "var(--trading-up)", fontWeight: "bold" } }}
            suffix="家"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="跌停"
            value={stats.limitDownCount}
            styles={{ content: { color: "var(--trading-down)", fontWeight: "bold" } }}
            suffix="家"
          />
        </Col>
      </Row>
    </Card>
  )
}

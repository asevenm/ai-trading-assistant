"use client"

import { useEffect, useState } from "react"
import { Statistic, Tag, Row, Col } from "antd"
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from "@ant-design/icons"
import type { DDEData } from "@/lib/level2-api"

interface DDEPanelProps {
  code: string
}

function formatAmount(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "--"
  const abs = Math.abs(v)
  if (abs >= 1e7) return (v / 1e8).toFixed(2) + "亿"
  if (abs >= 1e4) return (v / 1e4).toFixed(0) + "万"
  return v.toFixed(0)
}

export function DDEPanel({ code }: DDEPanelProps) {
  const [data, setData] = useState<DDEData | null>(null)

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/level2?action=dde&code=${code}`)
      if (!res.ok) return
      const json = await res.json()
      if (json) setData(json)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (!data) {
    return <div className="text-center text-muted-foreground py-4">加载DDE数据...</div>
  }

  const isPositive = (data.ddeNet ?? 0) > 0
  const netColor = isPositive ? "var(--trading-up)" : "var(--trading-down)"
  const netPct = data.ddeNetPct ?? 0

  return (
    <div className="space-y-4">
      {/* 核心指标 */}
      <div className="bg-secondary/30 rounded-lg p-4">
        <div className="text-center mb-3">
          <div className="text-muted-foreground text-xs mb-1">DDI 主力净额</div>
          <div
            className="text-2xl font-bold"
            style={{ color: netColor }}
          >
            {isPositive ? "+" : ""}{formatAmount(data.ddeNet)}
          </div>
          <Tag
            color={isPositive ? "red" : "green"}
            className="!mt-1"
            icon={
              isPositive ? (
                <ArrowUpOutlined />
              ) : (data.ddeNet ?? 0) < 0 ? (
                <ArrowDownOutlined />
              ) : (
                <MinusOutlined />
              )
            }
          >
            {netPct >= 0 ? "+" : ""}{netPct.toFixed(2)}%
          </Tag>
        </div>

        {/* 连续流入 */}
        {data.continuousDays > 0 && (
          <div className="text-center">
            <Tag color="volcano">连续 {data.continuousDays} 日主力净流入</Tag>
          </div>
        )}
      </div>

      {/* 明细 */}
      <Row gutter={[12, 12]}>
        <Col span={12}>
          <Statistic
            title="主力买入"
            value={formatAmount(data.ddeLarge)}
            styles={{ content: { fontSize: 16, color: "var(--trading-up)" } }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="主力卖出"
            value={formatAmount(data.ddeLargeSell)}
            styles={{ content: { fontSize: 16, color: "var(--trading-down)" } }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="大单比率"
            value={(data.ddeRatio ?? 0).toFixed(1) + "%"}
            styles={{ content: { fontSize: 16 } }}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="净额占比"
            value={(netPct >= 0 ? "+" : "") + netPct.toFixed(2) + "%"}
            styles={{
              content: {
                fontSize: 16,
                color: netPct >= 0 ? "var(--trading-up)" : "var(--trading-down)",
              },
            }}
          />
        </Col>
      </Row>

      {/* 说明 */}
      <div className="text-[10px] text-muted-foreground border-t border-border pt-2">
        DDI 指标基于大单(超大单+大单)买卖净额计算，反映主力资金方向和力度。
        数据来源为东方财富实时资金流向，非交易所 Level-2 原始数据。
      </div>
    </div>
  )
}

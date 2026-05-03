"use client"

import { Tabs, Typography } from "antd"
import type { ScreenStrategy } from "@/lib/ai/stock-screener"

const { Text } = Typography

interface StrategySelectorProps {
  strategies: ScreenStrategy[]
  activeStrategy: string
  onChange: (key: string) => void
}

export function StrategySelector({
  strategies,
  activeStrategy,
  onChange,
}: StrategySelectorProps) {
  const items = strategies.map((s) => ({
    key: s.id,
    label: (
      <div>
        <div>{s.name}</div>
        <Text type="secondary" className="text-xs">
          {s.description}
        </Text>
      </div>
    ),
  }))

  return (
    <Tabs
      activeKey={activeStrategy}
      onChange={onChange}
      items={items}
      type="card"
    />
  )
}

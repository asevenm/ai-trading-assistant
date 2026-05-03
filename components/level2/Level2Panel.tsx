"use client"

import { Card, Tabs } from "antd"
import { OrderBook } from "./OrderBook"
import { CapitalFlowChart } from "./CapitalFlowChart"
import { TransactionList } from "./TransactionList"
import { MainCapitalLine } from "./MainCapitalLine"
import { DDEPanel } from "./DDEPanel"

interface Level2PanelProps {
  code: string
}

export function Level2Panel({ code }: Level2PanelProps) {
  return (
    <div className="space-y-4">
      {/* 上半部分: 盘口 + 成交明细 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          title="5档盘口"
          size="small"
          styles={{ header: { borderBottom: "1px solid var(--border)" } }}
        >
          <OrderBook code={code} />
        </Card>

        <Card
          title="分时成交"
          size="small"
          styles={{ header: { borderBottom: "1px solid var(--border)" } }}
        >
          <TransactionList code={code} />
        </Card>
      </div>

      {/* 下半部分: 资金流向 Tabs */}
      <Card size="small">
        <Tabs
          size="small"
          items={[
            {
              key: "capital-flow",
              label: "分时资金",
              children: <CapitalFlowChart code={code} />,
            },
            {
              key: "main-capital",
              label: "主力趋势",
              children: <MainCapitalLine code={code} />,
            },
            {
              key: "dde",
              label: "DDE 指标",
              children: <DDEPanel code={code} />,
            },
          ]}
        />
      </Card>
    </div>
  )
}

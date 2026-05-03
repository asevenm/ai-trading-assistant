"use client"

import { Card, Table, Tag } from "antd"
import Link from "next/link"
import type { SectorData } from "@/lib/market-api"

interface SectorHeatmapProps {
  sectors: SectorData[]
}

export function SectorHeatmap({ sectors }: SectorHeatmapProps) {
  const columns = [
    {
      title: "排名",
      key: "rank",
      width: 60,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: "板块",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: SectorData) => (
        <Link href={`/sector/${record.code}`} className="font-medium text-primary hover:underline">{name}</Link>
      ),
    },
    {
      title: "涨跌幅",
      dataIndex: "changePercent",
      key: "changePercent",
      width: 100,
      render: (val: number) => (
        <Tag color={val >= 0 ? "red" : "green"} variant="filled">
          {val >= 0 ? "+" : ""}
          {val.toFixed(2)}%
        </Tag>
      ),
      sorter: (a: SectorData, b: SectorData) =>
        a.changePercent - b.changePercent,
    },
    {
      title: "领涨股",
      dataIndex: "leadingStock",
      key: "leadingStock",
    },
    {
      title: "领涨幅",
      dataIndex: "leadingStockChange",
      key: "leadingStockChange",
      width: 90,
      render: (val: number) => (
        <span className={val >= 0 ? "text-up" : "text-down"}>
          {val >= 0 ? "+" : ""}
          {val.toFixed(2)}%
        </span>
      ),
    },
  ]

  return (
    <Card title="行业板块排行" size="small" variant="borderless">
      <Table
        dataSource={sectors}
        columns={columns}
        rowKey="code"
        pagination={false}
        size="small"
        scroll={{ y: 400 }}
      />
    </Card>
  )
}

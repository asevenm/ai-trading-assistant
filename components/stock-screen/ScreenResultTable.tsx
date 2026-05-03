"use client"

import { Table, Tag, Button } from "antd"
import { PlusOutlined } from "@ant-design/icons"
import type { ScreenMatch } from "@/lib/ai/stock-screener"

interface ScreenResultTableProps {
  results: ScreenMatch[]
  loading: boolean
  onAddToWatchlist: (code: string, name: string) => void
  onViewDetail: (code: string) => void
}

export function ScreenResultTable({
  results,
  loading,
  onAddToWatchlist,
  onViewDetail,
}: ScreenResultTableProps) {
  const columns = [
    {
      title: "代码",
      dataIndex: "code",
      key: "code",
      width: 80,
      render: (code: string) => (
        <a onClick={() => onViewDetail(code)}>{code}</a>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 100,
      render: (name: string, record: ScreenMatch) => (
        <a onClick={() => onViewDetail(record.code)} className="font-medium">
          {name}
        </a>
      ),
    },
    {
      title: "现价",
      dataIndex: "price",
      key: "price",
      width: 80,
      render: (val: number) => val.toFixed(2),
    },
    {
      title: "涨幅",
      dataIndex: "changePercent",
      key: "changePercent",
      width: 80,
      render: (val: number) => (
        <span className={val >= 0 ? "text-up" : "text-down"}>
          {val >= 0 ? "+" : ""}
          {val.toFixed(2)}%
        </span>
      ),
      sorter: (a: ScreenMatch, b: ScreenMatch) =>
        a.changePercent - b.changePercent,
    },
    {
      title: "匹配原因",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
    },
    {
      title: "AI评分",
      key: "aiScore",
      width: 80,
      render: (_: unknown, record: ScreenMatch) => {
        const score = record.indicators?.aiScore
        if (typeof score !== "number") return "-"
        const color = score >= 80 ? "red" : score >= 60 ? "orange" : "default"
        return (
          <Tag color={color} variant="filled">
            {score}
          </Tag>
        )
      },
      sorter: (a: ScreenMatch, b: ScreenMatch) => {
        const sa = typeof a.indicators?.aiScore === "number" ? a.indicators.aiScore : 0
        const sb = typeof b.indicators?.aiScore === "number" ? b.indicators.aiScore : 0
        return (sa as number) - (sb as number)
      },
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_: unknown, record: ScreenMatch) => (
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onAddToWatchlist(record.code, record.name)}
        >
          自选
        </Button>
      ),
    },
  ]

  return (
    <Table
      dataSource={results}
      columns={columns}
      rowKey="code"
      loading={loading}
      pagination={{ pageSize: 20 }}
      size="small"
      locale={{ emptyText: "暂无筛选结果，点击执行筛选" }}
    />
  )
}

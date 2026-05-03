"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, Button, Spin, Table, Tag, Tooltip, App, Empty } from "antd"
import { ReloadOutlined, RocketOutlined } from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import Link from "next/link"

export interface PromotionScore {
  code: string
  name: string
  consecutiveBoards: number
  promotionTarget: string
  probability: number
  level: "low" | "medium" | "high" | "veryHigh"
  positives: string[]
  negatives: string[]
}

const levelColor: Record<PromotionScore["level"], string> = {
  veryHigh: "red",
  high: "orange",
  medium: "blue",
  low: "default",
}

const levelText: Record<PromotionScore["level"], string> = {
  veryHigh: "极高",
  high: "高",
  medium: "中",
  low: "低",
}

export function PromotionRanking() {
  const { message } = App.useApp()
  const [data, setData] = useState<PromotionScore[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/limit-up/promotion-probability")
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setData(json.scores || [])
    } catch {
      message.error("加载进阶概率失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ColumnsType<PromotionScore> = [
    {
      title: "进阶概率",
      dataIndex: "probability",
      width: 110,
      align: "center",
      sorter: (a, b) => a.probability - b.probability,
      defaultSortOrder: "descend",
      render: (v: number, record) => (
        <Tag variant="filled" color={levelColor[record.level]} style={{ minWidth: 60 }}>
          <span className="font-bold">{v}</span>
          <span className="ml-1 text-xs">{levelText[record.level]}</span>
        </Tag>
      ),
    },
    {
      title: "代码",
      dataIndex: "code",
      width: 80,
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
      title: "当前板位",
      dataIndex: "consecutiveBoards",
      width: 90,
      align: "center",
      sorter: (a, b) => a.consecutiveBoards - b.consecutiveBoards,
      render: (v: number) => (
        <Tag variant="filled" color={v >= 4 ? "purple" : v >= 2 ? "magenta" : "blue"}>
          {v}板
        </Tag>
      ),
    },
    {
      title: "目标",
      dataIndex: "promotionTarget",
      width: 120,
      render: (v: string) => <span className="text-muted text-sm">{v}</span>,
    },
    {
      title: "加分项",
      dataIndex: "positives",
      render: (factors: string[]) => (
        <div className="flex flex-wrap gap-1">
          {factors.length === 0 ? (
            <span className="text-muted">-</span>
          ) : (
            factors.map((f, i) => (
              <Tag key={i} variant="filled" color="green" style={{ fontSize: 11 }}>
                {f}
              </Tag>
            ))
          )}
        </div>
      ),
    },
    {
      title: "减分项",
      dataIndex: "negatives",
      width: 220,
      render: (factors: string[]) => (
        <div className="flex flex-wrap gap-1">
          {factors.length === 0 ? (
            <span className="text-muted">-</span>
          ) : (
            factors.map((f, i) => (
              <Tooltip key={i} title={f}>
                <Tag variant="filled" color="default" style={{ fontSize: 11 }}>
                  {f}
                </Tag>
              </Tooltip>
            ))
          )}
        </div>
      ),
    },
  ]

  const top = data.slice(0, 30)

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <RocketOutlined />
          <span>明日进阶概率 Top 30</span>
          <span className="text-muted text-xs font-normal">
            （封单×板块强度×梯队抱团×封板时间×炸板综合打分）
          </span>
        </div>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={fetchData}
          loading={loading}
        >
          刷新
        </Button>
      }
      variant="borderless"
      className="mb-6"
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : top.length === 0 ? (
        <Empty description="暂无涨停股或数据加载中" />
      ) : (
        <Table
          dataSource={top}
          columns={columns}
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ y: 500 }}
        />
      )}
    </Card>
  )
}

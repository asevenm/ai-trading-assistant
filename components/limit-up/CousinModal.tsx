"use client"

import { useEffect, useState } from "react"
import { Modal, Table, Tag, Spin, App, Empty, Tooltip } from "antd"
import type { ColumnsType } from "antd/es/table"
import Link from "next/link"

export interface CousinStock {
  code: string
  name: string
  price: number
  changePercent: number
  turnoverRate: number
  volumeRatio: number
  amount: number
  circulationMarketCap: number
  mainNetInflow: number
  industry: string
  sharedThemes: string[]
  cousinScore: number
  scoreFactors: string[]
}

interface CousinReport {
  source: {
    code: string
    name: string
    industry: string
    concepts: string[]
    isLimitUp: boolean
  }
  themes: { name: string; code: string }[]
  cousins: CousinStock[]
}

interface CousinModalProps {
  open: boolean
  sourceCode: string | null
  sourceName?: string
  onClose: () => void
}

const formatAmount = (v: number) => {
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}万`
  return v.toFixed(0)
}

const formatCap = (v: number) => {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}万`
  return v.toFixed(0)
}

const formatInflow = (v: number) => {
  if (Math.abs(v) >= 1e8) return `${v >= 0 ? "+" : ""}${(v / 1e8).toFixed(2)}亿`
  if (Math.abs(v) >= 1e4) return `${v >= 0 ? "+" : ""}${(v / 1e4).toFixed(0)}万`
  return v.toFixed(0)
}

export function CousinModal({ open, sourceCode, sourceName, onClose }: CousinModalProps) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CousinReport | null>(null)

  useEffect(() => {
    if (!open || !sourceCode) {
      setData(null)
      return
    }

    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/limit-up/cousins/${sourceCode}?limit=20`)
        if (!res.ok) throw new Error("Failed")
        const json: CousinReport = await res.json()
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) message.error("加载兄弟股失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [open, sourceCode, message])

  const columns: ColumnsType<CousinStock> = [
    {
      title: "分数",
      dataIndex: "cousinScore",
      width: 70,
      align: "center",
      sorter: (a, b) => a.cousinScore - b.cousinScore,
      defaultSortOrder: "descend",
      render: (v: number, record) => (
        <Tooltip title={record.scoreFactors.join("、") || "-"}>
          <Tag
            variant="filled"
            color={v >= 70 ? "red" : v >= 50 ? "orange" : v >= 30 ? "blue" : "default"}
          >
            {v.toFixed(0)}
          </Tag>
        </Tooltip>
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
      width: 90,
      render: (name: string, record) => (
        <Link href={`/stock/${record.code}`} className="font-medium text-primary hover:underline">
          {name}
        </Link>
      ),
    },
    {
      title: "现价",
      dataIndex: "price",
      width: 70,
      align: "right",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "涨幅",
      dataIndex: "changePercent",
      width: 70,
      align: "right",
      sorter: (a, b) => a.changePercent - b.changePercent,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up font-medium" : "text-down font-medium"}>
          {v >= 0 ? "+" : ""}
          {v.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "量比",
      dataIndex: "volumeRatio",
      width: 70,
      align: "right",
      sorter: (a, b) => a.volumeRatio - b.volumeRatio,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "换手率",
      dataIndex: "turnoverRate",
      width: 80,
      align: "right",
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: "主力净流入",
      dataIndex: "mainNetInflow",
      width: 110,
      align: "right",
      sorter: (a, b) => a.mainNetInflow - b.mainNetInflow,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up" : "text-down"}>{formatInflow(v)}</span>
      ),
    },
    {
      title: "流通市值",
      dataIndex: "circulationMarketCap",
      width: 100,
      align: "right",
      render: (v: number) => formatCap(v),
    },
    {
      title: "成交额",
      dataIndex: "amount",
      width: 90,
      align: "right",
      render: (v: number) => formatAmount(v),
    },
    {
      title: "共振板块",
      dataIndex: "sharedThemes",
      ellipsis: true,
      render: (themes: string[]) => (
        <div className="flex flex-wrap gap-1">
          {themes.map((t) => (
            <Tag key={t} variant="filled" color="purple">
              {t}
            </Tag>
          ))}
        </div>
      ),
    },
  ]

  return (
    <Modal
      title={
        <div>
          <span>兄弟股联动雷达</span>
          {sourceCode && (
            <span className="text-muted ml-2 text-sm font-normal">
              源票：{sourceName ?? ""} {sourceCode}
            </span>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
    >
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Spin size="large" />
        </div>
      ) : !data ? (
        <Empty description="无数据" />
      ) : data.themes.length === 0 ? (
        <Empty description="未匹配到该股票的概念/行业板块" />
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-muted text-sm">匹配板块：</span>
            {data.themes.map((t) => (
              <Tag key={t.code} variant="filled" color="cyan">
                {t.name}
              </Tag>
            ))}
          </div>
          {data.cousins.length === 0 ? (
            <Empty description="暂无符合条件的兄弟股（已剔除涨停/涨幅过大/市值差异大）" />
          ) : (
            <Table
              dataSource={data.cousins}
              columns={columns}
              rowKey="code"
              size="small"
              pagination={false}
              scroll={{ y: 500 }}
            />
          )}
        </div>
      )}
    </Modal>
  )
}

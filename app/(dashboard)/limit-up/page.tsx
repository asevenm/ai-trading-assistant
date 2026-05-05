"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, Button, Spin, Table, Tag, Statistic, Row, Col, App } from "antd"
import { ReloadOutlined, RiseOutlined, FallOutlined, ThunderboltOutlined, TeamOutlined } from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import type { LimitUpStock } from "@/lib/limit-up-api"
import type { LimitUpPoolStock } from "@/lib/theme-radar-api"
import { CousinModal } from "@/components/limit-up/CousinModal"
import { PromotionRanking } from "@/components/limit-up/PromotionRanking"
import { LadderPyramid } from "@/components/limit-up/LadderPyramid"
import Link from "next/link"

const { useApp } = App

interface LimitUpData {
  limitUp: {
    total: number
    stocks: LimitUpStock[]
    bustedCount: number
    bustedRate: number
  }
  limitDown: {
    total: number
    stocks: { code: string; name: string; price: number; changePercent: number; turnoverRate: number }[]
  }
  pool: LimitUpPoolStock[]
}

export default function LimitUpPage() {
  const { message } = useApp()
  const [data, setData] = useState<LimitUpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cousinSource, setCousinSource] = useState<{ code: string; name: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/limit-up")
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setData(json)
    } catch {
      message.error("加载涨停数据失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const limitUpColumns: ColumnsType<LimitUpStock> = [
    {
      title: "代码",
      dataIndex: "code",
      width: 80,
      render: (code: string) => (
        <Link href={`/stock/${code}`} className="font-mono text-primary hover:underline">{code}</Link>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      width: 100,
      render: (name: string, record) => (
        <Link href={`/stock/${record.code}`} className="font-medium text-primary hover:underline">{name}</Link>
      ),
    },
    {
      title: "价格",
      dataIndex: "price",
      width: 80,
      align: "right",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "涨幅",
      dataIndex: "changePercent",
      width: 80,
      align: "right",
      sorter: (a, b) => a.changePercent - b.changePercent,
      render: (v: number) => (
        <span className="text-up font-medium">+{v.toFixed(2)}%</span>
      ),
    },
    {
      title: "换手率",
      dataIndex: "turnoverRate",
      width: 80,
      align: "right",
      sorter: (a, b) => a.turnoverRate - b.turnoverRate,
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: "成交额",
      dataIndex: "amount",
      width: 100,
      align: "right",
      sorter: (a, b) => a.amount - b.amount,
      render: (v: number) => {
        if (v >= 1e7) return `${(v / 1e8).toFixed(2)}亿`
        return `${(v / 1e4).toFixed(0)}万`
      },
    },
    {
      title: "流通市值",
      dataIndex: "circulationMarketCap",
      width: 100,
      align: "right",
      sorter: (a, b) => a.circulationMarketCap - b.circulationMarketCap,
      render: (v: number) => {
        if (v >= 1e7) return `${(v / 1e8).toFixed(2)}亿`
        return `${(v / 1e4).toFixed(0)}万`
      },
    },
    {
      title: "所属行业",
      dataIndex: "industry",
      width: 100,
      render: (v: string) => v || "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          icon={<TeamOutlined />}
          onClick={() => setCousinSource({ code: record.code, name: record.name })}
        >
          找兄弟
        </Button>
      ),
    },
  ]

  const limitDownColumns: ColumnsType<LimitUpData["limitDown"]["stocks"][0]> = [
    {
      title: "代码",
      dataIndex: "code",
      width: 80,
      render: (code: string) => (
        <Link href={`/stock/${code}`} className="font-mono text-primary hover:underline">{code}</Link>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      width: 100,
      render: (name: string, record) => (
        <Link href={`/stock/${record.code}`} className="font-medium text-primary hover:underline">{name}</Link>
      ),
    },
    {
      title: "价格",
      dataIndex: "price",
      width: 80,
      align: "right",
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "跌幅",
      dataIndex: "changePercent",
      width: 80,
      align: "right",
      render: (v: number) => (
        <span className="text-down font-medium">{v.toFixed(2)}%</span>
      ),
    },
    {
      title: "换手率",
      dataIndex: "turnoverRate",
      width: 80,
      align: "right",
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ]

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">涨停板分析</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 统计概览 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="涨停数"
              value={data?.limitUp.total ?? 0}
              suffix="只"
              prefix={<RiseOutlined />}
              styles={{ content: { color: "var(--trading-up)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="跌停数"
              value={data?.limitDown.total ?? 0}
              suffix="只"
              prefix={<FallOutlined />}
              styles={{ content: { color: "var(--trading-down)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="炸板数"
              value={data?.limitUp.bustedCount ?? 0}
              suffix="只"
              prefix={<ThunderboltOutlined />}
              styles={{ content: { color: "var(--text-muted)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="炸板率"
              value={data?.limitUp.bustedRate ?? 0}
              precision={1}
              suffix="%"
              styles={{
                content: {
                  color: (data?.limitUp.bustedRate ?? 0) > 30
                    ? "var(--trading-down)"
                    : "var(--trading-up)",
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 连板梯队金字塔 */}
      <LadderPyramid
        pool={data?.pool ?? []}
        onFindCousins={(s) => setCousinSource(s)}
      />

      {/* 涨停行业分布 */}
      {data && data.limitUp.stocks.length > 0 && (
        <Card title="涨停行业分布" variant="borderless" className="mb-6">
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              data.limitUp.stocks.reduce<Record<string, number>>((acc, s) => {
                const key = s.industry || "其他"
                return { ...acc, [key]: (acc[key] || 0) + 1 }
              }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .map(([industry, count]) => (
                <Tag key={industry} color="blue" variant="filled">
                  {industry} ({count})
                </Tag>
              ))}
          </div>
        </Card>
      )}

      {/* 明日进阶概率 Top */}
      <PromotionRanking />

      {/* 涨停股列表 */}
      <Card title={`涨停股 (${data?.limitUp.total ?? 0})`} variant="borderless" className="mb-6">
        <Table
          dataSource={data?.limitUp.stocks ?? []}
          columns={limitUpColumns}
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ y: 400 }}
        />
      </Card>

      {/* 跌停股列表 */}
      {data && data.limitDown.stocks.length > 0 && (
        <Card title={`跌停股 (${data.limitDown.total})`} variant="borderless">
          <Table
            dataSource={data.limitDown.stocks}
            columns={limitDownColumns}
            rowKey="code"
            size="small"
            pagination={false}
            scroll={{ y: 300 }}
          />
        </Card>
      )}

      <CousinModal
        open={cousinSource !== null}
        sourceCode={cousinSource?.code ?? null}
        sourceName={cousinSource?.name}
        onClose={() => setCousinSource(null)}
      />
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Row,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from "antd"
import { CrownOutlined, FireOutlined, ReloadOutlined, ThunderboltOutlined } from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import Link from "next/link"
import type {
  GuestSeatStats,
  GuestTrackerSnapshot,
  RisingGuest,
} from "@/lib/guest-tracker-api"

export default function HotMoneyPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<GuestTrackerSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(5)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hot-money?days=${days}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setData(json)
    } catch {
      message.error("加载游资数据失败")
    } finally {
      setLoading(false)
    }
  }, [days, message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const seatColumns: ColumnsType<GuestSeatStats> = [
    {
      title: "席位",
      dataIndex: "seatName",
      width: 260,
      render: (name: string, record) => (
        <div className="flex items-center gap-2">
          {record.isFamous && <CrownOutlined className="text-yellow-500" />}
          <span className="text-sm">{name}</span>
        </div>
      ),
    },
    {
      title: "出手次数",
      dataIndex: "appearances",
      width: 100,
      align: "center",
      sorter: (a, b) => a.appearances - b.appearances,
      defaultSortOrder: "descend",
      render: (v: number) => <Tag variant="filled" color="blue">{v} 次</Tag>,
    },
    {
      title: "累计买入",
      dataIndex: "totalBuy",
      width: 110,
      align: "right",
      sorter: (a, b) => a.totalBuy - b.totalBuy,
      render: (v: number) => `${(v / 1e8).toFixed(2)}亿`,
    },
    {
      title: "净流入",
      dataIndex: "netAmount",
      width: 110,
      align: "right",
      sorter: (a, b) => a.netAmount - b.netAmount,
      render: (v: number) => (
        <span className={v >= 0 ? "text-up font-medium" : "text-down"}>
          {v >= 0 ? "+" : ""}
          {(v / 1e8).toFixed(2)}亿
        </span>
      ),
    },
    {
      title: "偏好关键词",
      dataIndex: "preferredIndustries",
      width: 220,
      render: (tags: GuestSeatStats["preferredIndustries"]) => (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t, i) => (
            <Tag key={i} color="gold" variant="filled" className="!text-xs">
              {t.name} ×{t.count}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "近期买入",
      dataIndex: "stocks",
      render: (stocks: GuestSeatStats["stocks"]) => (
        <div className="flex flex-wrap gap-1 max-w-[400px]">
          {stocks
            .filter((s) => s.net > 0)
            .sort((a, b) => b.net - a.net)
            .slice(0, 6)
            .map((s, i) => (
              <Link key={i} href={`/stock/${s.code}`}>
                <Tooltip title={`${s.date} 净买入 ${s.net >= 1e7 ? `${(s.net / 1e8).toFixed(2)}亿` : `${(s.net / 1e4).toFixed(0)}万`}`}>
                  <Tag color="red" variant="filled" className="cursor-pointer !m-0 !text-xs">
                    {s.name}
                  </Tag>
                </Tooltip>
              </Link>
            ))}
        </div>
      ),
    },
  ]

  const risingColumns: ColumnsType<RisingGuest> = [
    {
      title: "席位",
      dataIndex: "seatName",
      width: 260,
      render: (name: string) => <span className="text-sm">{name}</span>,
    },
    {
      title: "近期出手",
      dataIndex: "recentCount",
      width: 90,
      align: "center",
      render: (v: number) => (
        <Tag variant="filled" color="red">
          {v} 次
        </Tag>
      ),
    },
    {
      title: "前期出手",
      dataIndex: "previousCount",
      width: 90,
      align: "center",
      render: (v: number) => <Tag variant="filled">{v} 次</Tag>,
    },
    {
      title: "增长倍数",
      dataIndex: "growthRate",
      width: 100,
      align: "right",
      sorter: (a, b) => a.growthRate - b.growthRate,
      defaultSortOrder: "descend",
      render: (v: number) => (
        <span className="text-up font-medium">×{v.toFixed(1)}</span>
      ),
    },
    {
      title: "近期目标",
      dataIndex: "recentStocks",
      render: (stocks: RisingGuest["recentStocks"]) => (
        <div className="flex flex-wrap gap-1">
          {stocks.map((s, i) => (
            <Link key={i} href={`/stock/${s.code}`}>
              <Tag color="red" variant="filled" className="cursor-pointer !m-0">
                {s.name}
              </Tag>
            </Link>
          ))}
        </div>
      ),
    },
  ]

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  const totalNet = data?.famousGuests.reduce((s, g) => s + g.netAmount, 0) ?? 0

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <FireOutlined className="text-2xl text-primary" />
          <h1 className="text-2xl font-bold m-0">游资席位追踪</h1>
          {data && (
            <span className="text-sm text-muted ml-2">{data.period}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">回看天数</span>
          <InputNumber
            value={days}
            onChange={(v) => setDays(Number(v) || 5)}
            min={3}
            max={15}
            size="small"
            className="!w-20"
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="已识别席位"
              value={data?.topSeats.length ?? 0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="知名游资出手"
              value={data?.famousGuests.length ?? 0}
              suffix="个"
              prefix={<CrownOutlined />}
              styles={{ content: { color: "var(--trading-up)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="新晋活跃"
              value={data?.risingGuests.length ?? 0}
              suffix="个"
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="知名游资净额"
              value={totalNet / 1e8}
              precision={2}
              suffix="亿"
              styles={{
                content: {
                  color: totalNet >= 0 ? "var(--trading-up)" : "var(--trading-down)",
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: "famous",
            label: (
              <span>
                <CrownOutlined /> 知名游资动向
              </span>
            ),
            children: (
              <Card variant="borderless">
                {data && data.famousGuests.length > 0 ? (
                  <Table
                    dataSource={data.famousGuests}
                    columns={seatColumns}
                    rowKey="seatName"
                    size="small"
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                ) : (
                  <Empty description="近期未捕获到知名游资活动" />
                )}
              </Card>
            ),
          },
          {
            key: "rising",
            label: (
              <span>
                <ThunderboltOutlined /> 新晋活跃席位
              </span>
            ),
            children: (
              <Card variant="borderless">
                {data && data.risingGuests.length > 0 ? (
                  <Table
                    dataSource={data.risingGuests}
                    columns={risingColumns}
                    rowKey="seatName"
                    size="small"
                    pagination={false}
                    scroll={{ x: 900 }}
                  />
                ) : (
                  <Empty description="暂无明显新晋游资（活跃度增长需≥2x）" />
                )}
              </Card>
            ),
          },
          {
            key: "top",
            label: "出手最多",
            children: (
              <Card variant="borderless">
                {data && data.topSeats.length > 0 ? (
                  <Table
                    dataSource={data.topSeats}
                    columns={seatColumns}
                    rowKey="seatName"
                    size="small"
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                ) : (
                  <Empty />
                )}
              </Card>
            ),
          },
        ]}
      />

      <Card variant="borderless" className="mt-4" title="数据说明">
        <div className="text-sm text-muted space-y-1">
          <div>• 数据来源：东方财富龙虎榜（仅分析成交额 Top 30 的股票以控制延迟）</div>
          <div>• 知名游资：按全局 FAMOUS_SEATS 配置识别（拉萨东财、国泰君安溧阳路等）</div>
          <div>• 新晋活跃：前后期对比，近期出手 ≥ 2x 前期且 ≥ 2 次</div>
          <div>• 偏好关键词：从买入股票名称中识别行业关键词（粗粒度，后续可升级为概念板块映射）</div>
        </div>
      </Card>
    </div>
  )
}

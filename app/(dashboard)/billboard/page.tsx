"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, Button, Spin, Tag, Tabs, Modal, Table, App } from "antd"
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import type {
  BillboardStock,
  BillboardDetail,
  BillboardSeat,
} from "@/lib/billboard-api"

function formatAmount(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e7) return `${(v / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}万`
  return v.toFixed(0)
}

export default function BillboardPage() {
  const { message } = App.useApp()
  const [todayData, setTodayData] = useState<BillboardStock[]>([])
  const [historyData, setHistoryData] = useState<BillboardStock[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [detail, setDetail] = useState<BillboardDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchToday = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/billboard/today")
      if (!res.ok) throw new Error("Failed")
      setTodayData(await res.json())
    } catch {
      message.error("加载龙虎榜数据失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/billboard/history?days=5")
      if (!res.ok) throw new Error("Failed")
      setHistoryData(await res.json())
    } catch {
      message.error("加载历史数据失败")
    } finally {
      setHistoryLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchToday()
  }, [fetchToday])

  const handleViewDetail = async (code: string, name: string, date?: string) => {
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({ code })
      if (date) params.set("date", date)
      const res = await fetch(`/api/billboard/detail?${params}`)
      if (!res.ok) throw new Error("Failed")
      const data: BillboardDetail = await res.json()
      setDetail({ ...data, name: data.name || name })
    } catch {
      message.error("加载席位数据失败")
    } finally {
      setDetailLoading(false)
    }
  }

  const getSeatTag = (type: string) => {
    switch (type) {
      case "institution":
        return <Tag color="blue">机构</Tag>
      case "connect":
        return <Tag color="purple">北向</Tag>
      case "hotmoney":
        return <Tag color="red">游资</Tag>
      default:
        return <Tag>营业部</Tag>
    }
  }

  const stockColumns: ColumnsType<BillboardStock> = [
    {
      title: "股票",
      key: "stock",
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">{r.code}</div>
        </div>
      ),
    },
    {
      title: "涨跌幅",
      dataIndex: "changePercent",
      key: "changePercent",
      sorter: (a, b) => a.changePercent - b.changePercent,
      render: (val) => (
        <span className={val >= 0 ? "text-up font-medium" : "text-down font-medium"}>
          {val >= 0 ? "+" : ""}{val.toFixed(2)}%
        </span>
      ),
    },
    {
      title: "净买入",
      dataIndex: "netBuyAmount",
      key: "netBuyAmount",
      sorter: (a, b) => a.netBuyAmount - b.netBuyAmount,
      defaultSortOrder: "descend",
      render: (val) => (
        <span className={val >= 0 ? "text-up font-medium" : "text-down font-medium"}>
          {val >= 0 ? "+" : ""}{formatAmount(val)}
        </span>
      ),
    },
    {
      title: "买入额",
      dataIndex: "buyAmount",
      key: "buyAmount",
      render: (val) => formatAmount(val),
    },
    {
      title: "卖出额",
      dataIndex: "sellAmount",
      key: "sellAmount",
      render: (val) => formatAmount(val),
    },
    {
      title: "上榜原因",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
      width: 200,
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_, r) => (
        <Button
          size="small"
          icon={<SearchOutlined />}
          onClick={() => handleViewDetail(r.code, r.name, r.date)}
        >
          席位
        </Button>
      ),
    },
  ]

  const historyColumns: ColumnsType<BillboardStock> = [
    {
      title: "日期",
      dataIndex: "date",
      key: "date",
      width: 100,
      render: (val) => val?.slice(5) || "-",
    },
    ...stockColumns,
  ]

  const seatColumns: ColumnsType<BillboardSeat> = [
    {
      title: "营业部/机构",
      dataIndex: "seatName",
      key: "seatName",
      ellipsis: true,
      render: (name, r) => (
        <div className="flex items-center gap-2">
          {getSeatTag(r.type)}
          <span className={r.type === "hotmoney" ? "font-medium text-red-400" : ""}>
            {name}
          </span>
        </div>
      ),
    },
    {
      title: "买入",
      dataIndex: "buyAmount",
      key: "buyAmount",
      render: (val) => (
        <span className="text-up">{formatAmount(val)}</span>
      ),
    },
    {
      title: "卖出",
      dataIndex: "sellAmount",
      key: "sellAmount",
      render: (val) => (
        <span className="text-down">{formatAmount(val)}</span>
      ),
    },
    {
      title: "净额",
      dataIndex: "netAmount",
      key: "netAmount",
      render: (val) => (
        <span className={val >= 0 ? "text-up font-medium" : "text-down font-medium"}>
          {val >= 0 ? "+" : ""}{formatAmount(val)}
        </span>
      ),
    },
  ]

  // Separate institution buys from the detail
  const institutionBuys = detail?.buySeats.filter((s) => s.type === "institution") || []
  const institutionSells = detail?.sellSeats.filter((s) => s.type === "institution") || []

  const tabItems = [
    {
      key: "today",
      label: "当日龙虎榜",
      children: (
        <Card variant="borderless">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spin size="large" />
            </div>
          ) : todayData.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              今日暂无龙虎榜数据（非交易日或数据未更新）
            </div>
          ) : (
            <Table
              dataSource={todayData}
              columns={stockColumns}
              rowKey="tradeId"
              pagination={false}
              size="small"
            />
          )}
        </Card>
      ),
    },
    {
      key: "history",
      label: "历史龙虎榜",
      children: (
        <Card variant="borderless">
          {historyLoading ? (
            <div className="flex justify-center py-16">
              <Spin size="large" />
            </div>
          ) : historyData.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              暂无历史数据
            </div>
          ) : (
            <Table
              dataSource={historyData}
              columns={historyColumns}
              rowKey="tradeId"
              pagination={{ pageSize: 20 }}
              size="small"
            />
          )}
        </Card>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">龙虎榜</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchToday} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Summary Cards */}
      {todayData.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card variant="borderless" size="small">
            <div className="text-sm text-muted-foreground">上榜个股</div>
            <div className="text-2xl font-bold mt-1">
              {new Set(todayData.map((s) => s.code)).size}
            </div>
          </Card>
          <Card variant="borderless" size="small">
            <div className="text-sm text-muted-foreground">净买入最多</div>
            <div className="text-lg font-bold mt-1 text-up">
              {todayData.reduce((max, s) => s.netBuyAmount > max.netBuyAmount ? s : max, todayData[0])?.name || "-"}
            </div>
          </Card>
          <Card variant="borderless" size="small">
            <div className="text-sm text-muted-foreground">净卖出最多</div>
            <div className="text-lg font-bold mt-1 text-down">
              {todayData.reduce((min, s) => s.netBuyAmount < min.netBuyAmount ? s : min, todayData[0])?.name || "-"}
            </div>
          </Card>
          <Card variant="borderless" size="small">
            <div className="text-sm text-muted-foreground">机构参与</div>
            <div className="text-2xl font-bold mt-1">
              {todayData.filter((s) => s.reason.includes("机构")).length}
            </div>
          </Card>
        </div>
      )}

      <Tabs
        items={tabItems}
        defaultActiveKey="today"
        onChange={(key) => {
          if (key === "history" && historyData.length === 0) {
            fetchHistory()
          }
        }}
      />

      {/* Detail Modal */}
      <Modal
        title={detail ? `${detail.name}(${detail.code}) 席位明细` : "席位明细"}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={800}
      >
        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded bg-white/5">
                <div className="text-sm text-muted-foreground">买入总额</div>
                <div className="text-lg font-bold text-up">
                  {formatAmount(detail.totalBuy)}
                </div>
              </div>
              <div className="text-center p-3 rounded bg-white/5">
                <div className="text-sm text-muted-foreground">卖出总额</div>
                <div className="text-lg font-bold text-down">
                  {formatAmount(detail.totalSell)}
                </div>
              </div>
              <div className="text-center p-3 rounded bg-white/5">
                <div className="text-sm text-muted-foreground">净额</div>
                <div className={`text-lg font-bold ${detail.netBuy >= 0 ? "text-up" : "text-down"}`}>
                  {detail.netBuy >= 0 ? "+" : ""}{formatAmount(detail.netBuy)}
                </div>
              </div>
            </div>

            {/* Institution highlight */}
            {(institutionBuys.length > 0 || institutionSells.length > 0) && (
              <Card size="small" title="机构动向" variant="borderless">
                <div className="space-y-1 text-sm">
                  {institutionBuys.length > 0 && (
                    <div className="text-up">
                      机构买入 {institutionBuys.length} 席，
                      共 {formatAmount(institutionBuys.reduce((s, b) => s + b.buyAmount, 0))}
                    </div>
                  )}
                  {institutionSells.length > 0 && (
                    <div className="text-down">
                      机构卖出 {institutionSells.length} 席，
                      共 {formatAmount(institutionSells.reduce((s, b) => s + b.sellAmount, 0))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Buy seats */}
            <Card size="small" title="买入前5" variant="borderless">
              <Table
                dataSource={detail.buySeats}
                columns={seatColumns}
                rowKey={(r) => `${r.seatName}-${r.buyAmount}-${r.sellAmount}`}
                pagination={false}
                size="small"
              />
            </Card>

            {/* Sell seats */}
            <Card size="small" title="卖出前5" variant="borderless">
              <Table
                dataSource={detail.sellSeats}
                columns={seatColumns}
                rowKey={(r) => `${r.seatName}-${r.buyAmount}-${r.sellAmount}`}
                pagination={false}
                size="small"
              />
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

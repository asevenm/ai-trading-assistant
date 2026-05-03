"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Card,
  Button,
  Table,
  Tag,
  Switch,
  InputNumber,
  Select,
  Row,
  Col,
  Space,
  Statistic,
  App,
  Empty,
  Popconfirm,
} from "antd"
import {
  ReloadOutlined,
  DeleteOutlined,
  CheckOutlined,
  BellOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import "dayjs/locale/zh-cn"
import Link from "next/link"
import { useAlertStore } from "@/store/useAlertStore"
import {
  ALERT_TYPE_LABELS,
  ALERT_TYPE_COLORS,
  type AlertType,
} from "@/lib/alert-scanner"
import { isHKCode } from "@/lib/stock-api"
import { isSectorCode } from "@/lib/sector-api"
import type { Alert, AlertRule } from "@prisma/client"

dayjs.extend(relativeTime)
dayjs.locale("zh-cn")

const { useApp } = App

type MarketFilter = "A" | "HK"

function isHKAlert(alert: Alert): boolean {
  return isHKCode(alert.stockCode) || alert.message.includes("[港股]")
}

interface AlertsContentProps {
  market: MarketFilter
  title: string
}

export function AlertsContent({ market, title }: AlertsContentProps) {
  const { message } = useApp()
  const { alerts: allAlerts, rules, setAlerts, setRules, markAllRead } =
    useAlertStore()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"alerts" | "rules">("alerts")

  // 按市场过滤
  const alerts = allAlerts.filter((a) =>
    market === "HK" ? isHKAlert(a) : !isHKAlert(a)
  )
  const filteredUnreadCount = alerts.filter((a) => !a.read).length

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/alerts?limit=200")
      const { alerts: data } = await res.json()
      setAlerts(data || [])
    } catch {
      message.error("加载异动记录失败")
    } finally {
      setLoading(false)
    }
  }, [message, setAlerts])

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts/rules")
      const data = await res.json()
      setRules(data)
    } catch {
      message.error("加载规则失败")
    }
  }, [message, setRules])

  useEffect(() => {
    fetchAlerts()
    fetchRules()
  }, [fetchAlerts, fetchRules])

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readAll: true }),
      })
      markAllRead()
      message.success("已全部标为已读")
    } catch {
      message.error("操作失败")
    }
  }

  const handleClearOld = async () => {
    try {
      await fetch("/api/alerts?days=3", { method: "DELETE" })
      fetchAlerts()
      message.success("已清除旧记录")
    } catch {
      message.error("清除失败")
    }
  }

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      await fetch("/api/alerts/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
      })
      fetchRules()
    } catch {
      message.error("更新规则失败")
    }
  }

  const handleUpdateThreshold = async (rule: AlertRule, threshold: number) => {
    try {
      await fetch("/api/alerts/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, threshold }),
      })
      fetchRules()
    } catch {
      message.error("更新阈值失败")
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await fetch("/api/alerts/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      fetchRules()
      message.success("规则已删除")
    } catch {
      message.error("删除失败")
    }
  }

  const handleAddRule = async (type: AlertType) => {
    const defaults: Record<AlertType, { threshold: number; scope: string }> = {
      price_surge: { threshold: 5, scope: "watchlist" },
      price_drop: { threshold: -5, scope: "watchlist" },
      volume_surge: { threshold: 3, scope: "watchlist" },
      near_limit_up: { threshold: 2, scope: "watchlist" },
      rapid_rise: { threshold: 3, scope: "market" },
      rapid_drop: { threshold: -3, scope: "market" },
      sector_move: { threshold: 3, scope: "market" },
    }
    const d = defaults[type]
    try {
      await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ALERT_TYPE_LABELS[type],
          type,
          threshold: d.threshold,
          scope: d.scope,
        }),
      })
      fetchRules()
      message.success("规则已添加")
    } catch {
      message.error("添加失败")
    }
  }

  const alertColumns: ColumnsType<Alert> = [
    {
      title: "类型",
      dataIndex: "type",
      width: 100,
      filters: Object.entries(ALERT_TYPE_LABELS).map(([value, text]) => ({
        text,
        value,
      })),
      onFilter: (value, record) => record.type === value,
      render: (type: AlertType) => (
        <Tag color={ALERT_TYPE_COLORS[type] || "default"}>
          {ALERT_TYPE_LABELS[type] || type}
        </Tag>
      ),
    },
    {
      title: "股票/板块",
      dataIndex: "stockName",
      width: 120,
      render: (name: string, record) => {
        const stockCode = record.stockCode as string
        const isStock = /^\d{5,6}$/.test(stockCode)
        const isSector = isSectorCode(stockCode)
        if (isStock) {
          return (
            <Link href={`/stock/${stockCode}`} className="text-primary hover:underline">
              {name}
              <span className="text-xs text-muted-foreground ml-1">
                {stockCode}
              </span>
            </Link>
          )
        }
        if (isSector) {
          return (
            <Link href={`/sector/${stockCode}`} className="text-primary hover:underline">
              {name}
            </Link>
          )
        }
        return (
          <span>
            {name}
            <span className="text-xs text-muted-foreground ml-1">
              {stockCode}
            </span>
          </span>
        )
      },
    },
    {
      title: "触发信息",
      dataIndex: "message",
      ellipsis: true,
    },
    {
      title: "触发值",
      dataIndex: "currentValue",
      width: 100,
      render: (val: number, record) => {
        const color = val >= 0 ? "text-red-500" : "text-green-500"
        const unit = record.type === "volume_surge" ? "倍" : "%"
        return <span className={color}>{val.toFixed(2)}{unit}</span>
      },
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      width: 140,
      sorter: (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: "descend",
      render: (time: string) => (
        <span className="text-muted-foreground text-sm">
          {dayjs(time).format("HH:mm:ss")}
          <br />
          <span className="text-xs">{dayjs(time).format("MM-DD")}</span>
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "read",
      width: 60,
      render: (read: boolean) =>
        read ? (
          <span className="text-muted-foreground text-xs">已读</span>
        ) : (
          <Tag color="blue">未读</Tag>
        ),
    },
  ]

  // 港股不需要 near_limit_up 和 sector_move 规则
  const availableRuleTypes = market === "HK"
    ? Object.entries(ALERT_TYPE_LABELS).filter(
        ([key]) => key !== "near_limit_up" && key !== "sector_move"
      )
    : Object.entries(ALERT_TYPE_LABELS)

  const ruleColumns: ColumnsType<AlertRule> = [
    {
      title: "启用",
      dataIndex: "enabled",
      width: 70,
      render: (enabled: boolean, record) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={() => handleToggleRule(record)}
        />
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      width: 110,
      render: (type: AlertType) => (
        <Tag color={ALERT_TYPE_COLORS[type] || "default"}>
          {ALERT_TYPE_LABELS[type] || type}
        </Tag>
      ),
    },
    {
      title: "阈值",
      dataIndex: "threshold",
      width: 150,
      render: (val: number, record) => (
        <Space.Compact size="small">
          <InputNumber
            size="small"
            value={val}
            step={0.5}
            style={{ width: 80 }}
            onBlur={(e) => {
              const newVal = parseFloat(e.target.value)
              if (!isNaN(newVal) && newVal !== val) {
                handleUpdateThreshold(record, newVal)
              }
            }}
          />
          <Button size="small" disabled style={{ pointerEvents: "none" }}>
            {record.type === "volume_surge" ? "倍" : "%"}
          </Button>
        </Space.Compact>
      ),
    },
    {
      title: "监控范围",
      dataIndex: "scope",
      width: 100,
      render: (scope: string) => {
        const labels: Record<string, string> = {
          watchlist: "自选股",
          market: "全市场",
          custom: "自定义",
        }
        return <span>{labels[scope] || scope}</span>
      },
    },
    {
      title: "操作",
      width: 80,
      render: (_: unknown, record) => (
        <Popconfirm
          title="确定删除该规则？"
          onConfirm={() => handleDeleteRule(record.id)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const typeStats = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1
    return acc
  }, {})

  const topTypes = Object.entries(typeStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="flex gap-2">
          <Button
            type={activeTab === "alerts" ? "primary" : "default"}
            icon={<BellOutlined />}
            onClick={() => setActiveTab("alerts")}
          >
            异动记录
          </Button>
          <Button
            type={activeTab === "rules" ? "primary" : "default"}
            icon={<SettingOutlined />}
            onClick={() => setActiveTab("rules")}
          >
            规则设置
          </Button>
        </div>
      </div>

      {activeTab === "alerts" && (
        <>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="未读提醒" value={filteredUnreadCount} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="总计" value={alerts.length} />
              </Card>
            </Col>
            {topTypes.map(([type, count]) => (
              <Col span={3} key={type}>
                <Card size="small">
                  <Statistic
                    title={ALERT_TYPE_LABELS[type as AlertType] || type}
                    value={count}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          <Card
            size="small"
            title="异动记录"
            extra={
              <div className="flex gap-2">
                {filteredUnreadCount > 0 && (
                  <Button
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={handleMarkAllRead}
                  >
                    全部已读
                  </Button>
                )}
                <Popconfirm
                  title="清除3天前的记录？"
                  onConfirm={handleClearOld}
                >
                  <Button size="small" icon={<DeleteOutlined />}>
                    清除旧记录
                  </Button>
                </Popconfirm>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={fetchAlerts}
                >
                  刷新
                </Button>
              </div>
            }
          >
            <Table
              columns={alertColumns}
              dataSource={alerts}
              rowKey="id"
              size="small"
              loading={loading}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              rowClassName={(record) => (!record.read ? "bg-blue-500/5" : "")}
              locale={{
                emptyText: (
                  <Empty
                    description="暂无异动记录"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          </Card>
        </>
      )}

      {activeTab === "rules" && (
        <Card
          size="small"
          title="异动规则管理"
          extra={
            <Select
              placeholder="添加规则"
              style={{ width: 140 }}
              suffixIcon={<PlusOutlined />}
              value={null}
              onChange={(type) => {
                if (type) handleAddRule(type as AlertType)
              }}
              options={availableRuleTypes.map(([value, label]) => ({
                value,
                label,
              }))}
            />
          }
        >
          <Table
            columns={ruleColumns}
            dataSource={rules}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  description="暂无规则，请添加"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        </Card>
      )}
    </div>
  )
}

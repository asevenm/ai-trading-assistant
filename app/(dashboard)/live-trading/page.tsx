"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
} from "antd"
import {
  ReloadOutlined,
  FireOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  CrownOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import dayjs from "dayjs"
import Link from "next/link"
import type { PreLimitUpCandidate } from "@/lib/pre-limit-up-api"
import type { SealOrderStock } from "@/lib/seal-order-api"
import {
  STAGE_COLORS,
  STAGE_EMOJI,
  STAGE_LABELS,
} from "@/lib/rotation/stage-lookup"
import type { RotationStage } from "@/lib/rotation/types"
import type { Alert as AlertRow } from "@prisma/client"
import { ALERT_TYPE_LABELS, ALERT_TYPE_COLORS, type AlertType } from "@/lib/alert-scanner"

interface HotTheme {
  boardId: string
  boardName: string
  boardType: "INDUSTRY" | "CONCEPT"
  stage: RotationStage
  stageLabel: string
  strengthScore: number
  deltaScore: number | null
  limitUpCount: number
  topStreak: number
  mainNetInflow: number
  leaderStocks: string[]
}

interface DashboardData {
  scannedAt: string
  tradeDate: string
  hotThemes: HotTheme[]
  preLimitUp: PreLimitUpCandidate[]
  sealOrders: SealOrderStock[]
  recentHotAlerts: AlertRow[]
}

const REFRESH_INTERVAL_MS = 30_000

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "-"
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(value / 1e4).toFixed(0)}万`
  return value.toFixed(0)
}

function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "-"
  return `${value.toFixed(digits)}%`
}

const RISK_TONE: Record<SealOrderStock["bustRiskLevel"], string> = {
  low: "green",
  medium: "blue",
  high: "orange",
  critical: "red",
}

const RISK_LABEL: Record<SealOrderStock["bustRiskLevel"], string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "极高",
}

export default function LiveTradingPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await fetch("/api/live-trading/dashboard", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed")
        const json = (await res.json()) as DashboardData
        setData(json)
      } catch {
        if (!silent) message.error("加载盘中数据失败")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [message],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [autoRefresh, fetchData])

  const themeBuckets = useMemo(() => {
    if (!data) return { rising: [], starting: [] }
    return {
      rising: data.hotThemes.filter((t) => t.stage === "RISING"),
      starting: data.hotThemes.filter((t) => t.stage === "STARTING"),
    }
  }, [data])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 头部统计 */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ThunderboltOutlined className="text-orange-500" />
            盘中作战面板
          </h1>
          <div className="text-xs text-muted-foreground mt-1">
            交易日 {data?.tradeDate ?? "-"} · 最近刷新{" "}
            {data ? dayjs(data.scannedAt).format("HH:mm:ss") : "-"} ·
            自动刷新 {autoRefresh ? "ON" : "OFF"}（30s）
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type={autoRefresh ? "primary" : "default"}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            {autoRefresh ? "暂停自动刷新" : "开启自动刷新"}
          </Button>
          <Button
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={() => fetchData()}
            loading={refreshing}
          >
            手动刷新
          </Button>
        </div>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card variant="borderless" size="small">
            <Statistic
              title="风口题材"
              value={data?.hotThemes.length ?? 0}
              prefix={<FireOutlined className="text-red-500" />}
              suffix={`/ 主升 ${themeBuckets.rising.length} · 启动 ${themeBuckets.starting.length}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" size="small">
            <Statistic
              title="即将涨停"
              value={data?.preLimitUp.length ?? 0}
              prefix={<RocketOutlined className="text-orange-400" />}
              suffix="只候选"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" size="small">
            <Statistic
              title="封单监控"
              value={data?.sealOrders.length ?? 0}
              prefix={<SafetyCertificateOutlined className="text-blue-400" />}
              suffix={`/ 高风险 ${data?.sealOrders.filter((s) => s.bustRiskLevel === "critical" || s.bustRiskLevel === "high").length ?? 0}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" size="small">
            <Statistic
              title="风口异动 (30min)"
              value={data?.recentHotAlerts.length ?? 0}
              prefix={<ThunderboltOutlined className="text-yellow-400" />}
              suffix="条"
            />
          </Card>
        </Col>
      </Row>

      {/* 风口题材区 */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <FireOutlined className="text-red-500" /> 风口题材（主升 / 启动）
          </span>
        }
        variant="borderless"
        extra={
          <Link href="/rotation-live" className="text-xs text-blue-400">
            完整轮动板 →
          </Link>
        }
      >
        {data && data.hotThemes.length > 0 ? (
          <Row gutter={[12, 12]}>
            {data.hotThemes.map((theme) => (
              <Col xs={24} sm={12} md={8} lg={6} key={`${theme.boardType}:${theme.boardId}`}>
                <ThemeCard theme={theme} />
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="当前无 RISING / STARTING 题材" />
        )}
      </Card>

      {/* 即将涨停 + 封单监控 双栏 */}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <PreLimitUpPanel data={data?.preLimitUp ?? []} />
        </Col>
        <Col xs={24} lg={12}>
          <SealOrderPanel data={data?.sealOrders ?? []} />
        </Col>
      </Row>

      {/* 风口异动流 */}
      <HotAlertsPanel data={data?.recentHotAlerts ?? []} />
    </div>
  )
}

// ==================== 风口题材卡片 ====================

function ThemeCard({ theme }: { theme: HotTheme }) {
  const stageColor = STAGE_COLORS[theme.stage]
  const inflowSign = theme.mainNetInflow >= 0 ? "+" : ""

  return (
    <Card
      size="small"
      variant="outlined"
      style={{
        borderColor:
          theme.stage === "RISING" ? "rgba(239,68,68,0.55)" : "rgba(34,197,94,0.55)",
        backgroundColor:
          theme.stage === "RISING" ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)",
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{theme.boardName}</span>
          <span className="text-[10px] text-muted-foreground">
            {theme.boardType === "INDUSTRY" ? "行业" : "概念"} · {theme.boardId}
          </span>
        </div>
        <Tag color={stageColor} variant="filled">
          {STAGE_EMOJI[theme.stage]} {STAGE_LABELS[theme.stage]}
        </Tag>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs">
        <Tooltip title="板块强度评分（0-100）">
          <div>
            <span className="text-muted-foreground">强度 </span>
            <span className="font-semibold">{theme.strengthScore.toFixed(0)}</span>
            {theme.deltaScore !== null && (
              <span
                className={
                  theme.deltaScore > 0 ? "text-up ml-1" : theme.deltaScore < 0 ? "text-down ml-1" : "ml-1"
                }
              >
                ({theme.deltaScore > 0 ? "+" : ""}
                {theme.deltaScore.toFixed(0)})
              </span>
            )}
          </div>
        </Tooltip>
        <div>
          <span className="text-muted-foreground">涨停 </span>
          <span className="font-semibold text-up">{theme.limitUpCount}</span>
        </div>
        <div>
          <span className="text-muted-foreground">最高 </span>
          <span className="font-semibold">{theme.topStreak} 连</span>
        </div>
        <Tooltip title="主力净流入">
          <div>
            <span className="text-muted-foreground">主力 </span>
            <span
              className={theme.mainNetInflow >= 0 ? "text-up font-semibold" : "text-down font-semibold"}
            >
              {inflowSign}
              {formatAmount(theme.mainNetInflow)}
            </span>
          </div>
        </Tooltip>
      </div>

      {theme.leaderStocks.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/10 text-xs">
          <CrownOutlined className="text-yellow-500" />{" "}
          <span className="text-muted-foreground">龙头：</span>
          {theme.leaderStocks.slice(0, 3).map((code, idx) => (
            <Link
              key={code}
              href={`/stock/${code}`}
              className="text-blue-400 hover:underline ml-1 font-mono"
            >
              {code}
              {idx < Math.min(theme.leaderStocks.length, 3) - 1 ? "," : ""}
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ==================== 即将涨停 ====================

function PreLimitUpPanel({ data }: { data: PreLimitUpCandidate[] }) {
  const columns: ColumnsType<PreLimitUpCandidate> = [
    {
      title: "代码/名称",
      dataIndex: "code",
      width: 110,
      render: (code: string, record) => (
        <Link href={`/stock/${code}`} className="text-blue-400 hover:underline">
          <div className="flex flex-col">
            <span className="font-medium text-xs">{record.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{code}</span>
          </div>
        </Link>
      ),
    },
    {
      title: "距停",
      dataIndex: "distanceToLimit",
      width: 60,
      align: "right",
      sorter: (a, b) => a.distanceToLimit - b.distanceToLimit,
      defaultSortOrder: "ascend",
      render: (v: number) => (
        <span className={v <= 1 ? "text-up font-semibold" : ""}>{formatPercent(v)}</span>
      ),
    },
    {
      title: "涨速",
      dataIndex: "speed",
      width: 70,
      align: "right",
      sorter: (a, b) => a.speed - b.speed,
      render: (v: number) => (
        <span className={v > 0.5 ? "text-up font-semibold" : v < 0 ? "text-down" : ""}>
          {formatPercent(v)}
        </span>
      ),
    },
    {
      title: "量比",
      dataIndex: "volumeRatio",
      width: 60,
      align: "right",
      render: (v: number) => v.toFixed(1),
    },
    {
      title: "评分",
      dataIndex: "score",
      width: 70,
      align: "right",
      sorter: (a, b) => a.score - b.score,
      render: (v: number) => {
        const tone = v >= 80 ? "red" : v >= 60 ? "orange" : "blue"
        return (
          <Tag color={tone} variant="filled">
            {v.toFixed(0)}
          </Tag>
        )
      },
    },
    {
      title: "信号",
      dataIndex: "signals",
      ellipsis: true,
      render: (signals: string[]) => (
        <Tooltip title={signals.join(" / ")}>
          <span className="text-[11px] text-muted-foreground">{signals.slice(0, 2).join(" · ")}</span>
        </Tooltip>
      ),
    },
  ]

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <RocketOutlined className="text-orange-400" /> 即将涨停 Top 12
        </span>
      }
      variant="borderless"
      extra={
        <Link href="/pre-limit-up" className="text-xs text-blue-400">
          完整列表 →
        </Link>
      }
    >
      <Table
        size="small"
        rowKey="code"
        columns={columns}
        dataSource={data}
        pagination={false}
        scroll={{ y: 380 }}
        locale={{ emptyText: <Empty description="暂无候选" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </Card>
  )
}

// ==================== 涨停板封单监控 ====================

function SealOrderPanel({ data }: { data: SealOrderStock[] }) {
  const columns: ColumnsType<SealOrderStock> = [
    {
      title: "代码/名称",
      dataIndex: "code",
      width: 110,
      render: (code: string, record) => (
        <Link href={`/stock/${code}`} className="text-blue-400 hover:underline">
          <div className="flex flex-col">
            <span className="font-medium text-xs">{record.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{code}</span>
          </div>
        </Link>
      ),
    },
    {
      title: "连板",
      dataIndex: "consecutiveBoards",
      width: 60,
      align: "center",
      render: (v: number) => (
        <Tag color={v >= 5 ? "red" : v >= 3 ? "orange" : "blue"} variant="filled">
          {v} 连
        </Tag>
      ),
    },
    {
      title: "封比",
      dataIndex: "sealRatio",
      width: 65,
      align: "right",
      sorter: (a, b) => a.sealRatio - b.sealRatio,
      render: (v: number) => (
        <Tooltip title="封单 / 流通市值">
          <span className={v >= 3 ? "text-up font-semibold" : ""}>{formatPercent(v, 2)}</span>
        </Tooltip>
      ),
    },
    {
      title: "封单",
      dataIndex: "sealAmount",
      width: 80,
      align: "right",
      render: (v: number) => formatAmount(v),
    },
    {
      title: "炸板风险",
      dataIndex: "bustProbability",
      width: 100,
      sorter: (a, b) => a.bustProbability - b.bustProbability,
      defaultSortOrder: "descend",
      render: (v: number, record) => (
        <Tooltip title={record.bustFactors.join(" / ") || "无明显风险因子"}>
          <Tag color={RISK_TONE[record.bustRiskLevel]} variant="filled">
            {RISK_LABEL[record.bustRiskLevel]} {v.toFixed(0)}
          </Tag>
        </Tooltip>
      ),
    },
  ]

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <SafetyCertificateOutlined className="text-blue-400" /> 涨停板封单监控
        </span>
      }
      variant="borderless"
      extra={
        <Link href="/seal-order" className="text-xs text-blue-400">
          完整列表 →
        </Link>
      }
    >
      <Table
        size="small"
        rowKey="code"
        columns={columns}
        dataSource={data}
        pagination={false}
        scroll={{ y: 380 }}
        locale={{ emptyText: <Empty description="今日暂无涨停" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </Card>
  )
}

// ==================== 风口异动流 ====================

function parseAlertExtras(detail: string | null): { stage: RotationStage | null; theme: string | null } {
  if (!detail) return { stage: null, theme: null }
  try {
    const parsed = JSON.parse(detail) as { themeStage?: string; themeBoardName?: string }
    const stage = parsed.themeStage
    const valid =
      stage === "STARTING" || stage === "RISING" || stage === "DIVERGING" || stage === "FADING"
    return {
      stage: valid ? (stage as RotationStage) : null,
      theme: parsed.themeBoardName ?? null,
    }
  } catch {
    return { stage: null, theme: null }
  }
}

function HotAlertsPanel({ data }: { data: AlertRow[] }) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ThunderboltOutlined className="text-yellow-400" /> 风口异动流
          <span className="text-xs text-muted-foreground font-normal">最近 30 分钟 · 主升/启动</span>
        </span>
      }
      variant="borderless"
      extra={
        <Link href="/alerts" className="text-xs text-blue-400">
          全部异动 →
        </Link>
      }
    >
      {data.length === 0 ? (
        <Empty description="暂无风口异动" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <tbody>
              {data.map((alert) => {
                const { stage, theme } = parseAlertExtras(alert.detail)
                return (
                  <tr
                    key={alert.id}
                    className="border-b border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="py-1.5 px-2 text-muted-foreground font-mono w-20">
                      {dayjs(alert.createdAt).format("HH:mm:ss")}
                    </td>
                    <td className="py-1.5 px-2 w-20">
                      {stage && (
                        <Tag color={STAGE_COLORS[stage]} variant="filled">
                          {STAGE_EMOJI[stage]}
                        </Tag>
                      )}
                    </td>
                    <td className="py-1.5 px-2 w-24 text-muted-foreground truncate" title={theme ?? ""}>
                      {theme ?? "-"}
                    </td>
                    <td className="py-1.5 px-2 w-24">
                      <Tag color={ALERT_TYPE_COLORS[alert.type as AlertType] || "default"}>
                        {ALERT_TYPE_LABELS[alert.type as AlertType] || alert.type}
                      </Tag>
                    </td>
                    <td className="py-1.5 px-2">
                      <Link
                        href={`/stock/${alert.stockCode}`}
                        className="text-blue-400 hover:underline mr-2 font-medium"
                      >
                        {alert.stockName}
                      </Link>
                      <span className="text-muted-foreground">{alert.message}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
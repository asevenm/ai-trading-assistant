"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Radio,
  Row,
  Segmented,
  Spin,
  Statistic,
  Tabs,
  Tag,
} from "antd"
import {
  BulbOutlined,
  FireOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  RiseOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons"
import Link from "next/link"
import type { LimitUpPoolStock, ThemeCluster, ThemeRadarSnapshot, ThemeStage } from "@/lib/theme-radar-api"
import type { ThemeAnalysis } from "@/lib/ai/theme-cluster"
import { StageMap, type RadarBoard } from "@/components/rotation/StageMap"
import { BoardStageList } from "@/components/rotation/BoardStageList"

const STAGE_LABEL: Record<ThemeStage, string> = {
  initial: "初期（起风）",
  expanding: "扩散中",
  peak: "高潮",
  fading: "退潮",
}

const STAGE_COLOR: Record<ThemeStage, string> = {
  initial: "blue",
  expanding: "green",
  peak: "orange",
  fading: "red",
}

interface RadarResponse {
  tradeDate: string
  timeSlot: string | null
  availableSlots: string[]
  boards: RadarBoard[]
}

export default function ThemeRadarPage() {
  const { message } = App.useApp()
  const [snapshot, setSnapshot] = useState<ThemeRadarSnapshot | null>(null)
  const [analysis, setAnalysis] = useState<ThemeAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  // 阶段地图相关状态
  const [boardType, setBoardType] = useState<"INDUSTRY" | "CONCEPT">("CONCEPT")
  const [radar, setRadar] = useState<RadarResponse | null>(null)
  const [radarLoading, setRadarLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [snapshotting, setSnapshotting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/theme-radar", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed")
      const json = (await res.json()) as ThemeRadarSnapshot
      setSnapshot(json)
    } catch {
      message.error("加载题材雷达失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  const fetchRadar = useCallback(
    async (type: "INDUSTRY" | "CONCEPT", slot?: string | null) => {
      setRadarLoading(true)
      try {
        const params = new URLSearchParams({ boardType: type, limit: "60" })
        if (slot) params.set("timeSlot", slot)
        const res = await fetch(`/api/rotation/radar?${params.toString()}`, { cache: "no-store" })
        if (!res.ok) throw new Error("Failed")
        const json = (await res.json()) as RadarResponse
        setRadar(json)
        if (json.timeSlot && !slot) {
          setSelectedSlot(json.timeSlot)
        }
      } catch {
        message.error("加载阶段地图失败")
      } finally {
        setRadarLoading(false)
      }
    },
    [message]
  )

  const triggerSnapshot = useCallback(async () => {
    setSnapshotting(true)
    try {
      const res = await fetch("/api/rotation/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      message.success(
        `快照完成 [${json.result?.timeSlot}] 行业 ${json.result?.industryCount} / 概念 ${json.result?.conceptCount} 个板块, 事件 ${json.result?.eventsCreated}`
      )
      await fetchRadar(boardType)
    } catch (error) {
      message.error("快照失败：" + (error instanceof Error ? error.message : ""))
    } finally {
      setSnapshotting(false)
    }
  }, [boardType, fetchRadar, message])

  const runAIAnalysis = useCallback(async () => {
    setAnalyzing(true)
    try {
      const res = await fetch("/api/theme-radar/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setSnapshot(json.snapshot)
      setAnalysis(json.analysis)
      message.success("AI 分析完成")
    } catch {
      message.error("AI 分析失败")
    } finally {
      setAnalyzing(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
    fetchRadar(boardType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChangeBoardType = useCallback(
    (next: "INDUSTRY" | "CONCEPT") => {
      setBoardType(next)
      setSelectedSlot(null)
      fetchRadar(next)
    },
    [fetchRadar]
  )

  const onChangeSlot = useCallback(
    (slot: string) => {
      setSelectedSlot(slot)
      fetchRadar(boardType, slot)
    },
    [boardType, fetchRadar]
  )

  const stageStats = useMemo(() => {
    const stats: Record<string, number> = {
      STARTING: 0,
      RISING: 0,
      DIVERGING: 0,
      FADING: 0,
      NONE: 0,
    }
    for (const b of radar?.boards ?? []) {
      stats[b.stage ?? "NONE"]++
    }
    return stats
  }, [radar])

  const stageMapTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Radio.Group
            value={boardType}
            onChange={(e) => onChangeBoardType(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="CONCEPT">概念板块</Radio.Button>
            <Radio.Button value="INDUSTRY">行业板块</Radio.Button>
          </Radio.Group>
          {radar?.availableSlots && radar.availableSlots.length > 0 && (
            <Segmented
              value={selectedSlot ?? radar.timeSlot ?? ""}
              onChange={(v) => onChangeSlot(String(v))}
              options={radar.availableSlots.map((s) => ({ label: s, value: s }))}
            />
          )}
        </div>
        <div className="flex gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchRadar(boardType, selectedSlot)}
            loading={radarLoading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={triggerSnapshot}
            loading={snapshotting}
          >
            立即采集快照
          </Button>
        </div>
      </div>

      {/* 阶段统计 */}
      <Row gutter={16}>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic title="🟢 启动" value={stageStats.STARTING} />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="🔥 主升"
              value={stageStats.RISING}
              styles={{ content: { color: "var(--trading-up)" } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="⚠️ 分歧"
              value={stageStats.DIVERGING}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" size="small">
            <Statistic
              title="🔻 退潮"
              value={stageStats.FADING}
              styles={{ content: { color: "var(--trading-down)" } }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" size="small">
            <Statistic
              title="数据时点"
              value={radar?.tradeDate ? `${radar.tradeDate} ${radar.timeSlot ?? "-"}` : "-"}
            />
          </Card>
        </Col>
      </Row>

      {/* 四象限图 */}
      <Card variant="borderless" title="阶段地图（X=势头ΔS / Y=强度分S / 气泡=主力净流入）">
        {radarLoading ? (
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        ) : !radar || radar.boards.length === 0 ? (
          <Empty
            description={
              <div>
                <div className="mb-2">暂无快照数据</div>
                <div className="text-xs text-muted">
                  点击右上角"立即采集快照"获取第一份数据。每天 7 个时点累积后才能看到完整轨迹。
                </div>
              </div>
            }
          />
        ) : (
          <StageMap boards={radar.boards} />
        )}
      </Card>

      {/* 板块阶段列表（按阶段分组） */}
      {radar && radar.boards.length > 0 && (
        <Card variant="borderless" title="板块阶段清单">
          <BoardStageList boards={radar.boards} />
        </Card>
      )}
    </div>
  )

  const tierViewTab = (
    <>
      {/* 顶部统计 */}
      {snapshot && <SummaryStats snapshot={snapshot} />}

      {/* AI 主线分析 */}
      {analysis && <AIAnalysisCard analysis={analysis} />}

      {/* 主题梯队列表 */}
      {snapshot && snapshot.themes.length > 0 ? (
        <div className="space-y-4">
          {snapshot.themes.map((theme) => (
            <ThemeCard key={theme.name} theme={theme} />
          ))}
        </div>
      ) : (
        <Card variant="borderless">
          <Empty description="今日暂无主题聚合数据（至少需要2只涨停股同属一个概念）" />
        </Card>
      )}

      {/* 未归类涨停股 */}
      {snapshot && snapshot.uncategorized.length > 0 && (
        <Card
          title={`散票涨停 (${snapshot.uncategorized.length})`}
          variant="borderless"
          className="mt-4"
        >
          <div className="flex flex-wrap gap-2">
            {snapshot.uncategorized.map((s) => (
              <Link key={s.code} href={`/stock/${s.code}`}>
                <Tag color="default" variant="filled" className="cursor-pointer">
                  {s.name} ({s.consecutiveBoards}板)
                </Tag>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  )

  if (loading && !radar) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <RadarChartOutlined className="text-2xl text-primary" />
          <h1 className="text-2xl font-bold m-0">题材扩散雷达</h1>
        </div>
        <div className="flex gap-2">
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新数据
          </Button>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={runAIAnalysis}
            loading={analyzing}
            disabled={!snapshot || snapshot.themes.length === 0}
          >
            AI 识别主线
          </Button>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        title="新增「阶段地图」视图：基于 6 维复合打分追踪板块强度演化（启动 → 主升 → 分歧 → 退潮）。需先触发快照采集积累数据。"
        className="mb-4"
        closable
      />

      <Tabs
        defaultActiveKey="stage-map"
        items={[
          {
            key: "stage-map",
            label: "阶段地图",
            children: stageMapTab,
          },
          {
            key: "tier-view",
            label: "主题梯队",
            children: tierViewTab,
          },
        ]}
      />
    </div>
  )
}

function SummaryStats({ snapshot }: { snapshot: ThemeRadarSnapshot }) {
  const maxConsec = snapshot.themes.reduce((m, t) => Math.max(m, t.maxConsecutive), 0)
  const bustRate =
    snapshot.totalLimitUp > 0
      ? (snapshot.totalBusted / (snapshot.totalLimitUp + snapshot.totalBusted)) * 100
      : 0
  return (
    <Row gutter={16} className="mb-6">
      <Col span={6}>
        <Card variant="borderless">
          <Statistic
            title="涨停总数"
            value={snapshot.totalLimitUp}
            suffix="只"
            prefix={<RiseOutlined />}
            styles={{ content: { color: "var(--trading-up)" } }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card variant="borderless">
          <Statistic
            title="识别主题"
            value={snapshot.themes.length}
            suffix="个"
            prefix={<FireOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card variant="borderless">
          <Statistic
            title="最高连板"
            value={maxConsec}
            suffix="板"
            prefix={<ThunderboltOutlined />}
            styles={{ content: { color: "var(--trading-up)" } }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card variant="borderless">
          <Statistic
            title="炸板率"
            value={bustRate}
            precision={1}
            suffix="%"
            styles={{
              content: {
                color: bustRate > 40 ? "var(--trading-down)" : "var(--trading-up)",
              },
            }}
          />
        </Card>
      </Col>
    </Row>
  )
}

function AIAnalysisCard({ analysis }: { analysis: ThemeAnalysis }) {
  return (
    <Card
      variant="borderless"
      className="mb-6"
      title={
        <div className="flex items-center gap-2">
          <BulbOutlined className="text-primary" />
          <span>AI 主线判断</span>
        </div>
      }
    >
      <div className="mb-4 text-lg font-medium">{analysis.mainline}</div>

      {analysis.coreThemes.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-muted mb-2">核心主题</div>
          <div className="space-y-3">
            {analysis.coreThemes.map((t, i) => (
              <div key={i} className="border border-border rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{t.name}</span>
                  <Tag color="blue" variant="filled">
                    {t.stage}
                  </Tag>
                </div>
                <div className="text-sm text-muted mb-1">{t.narrative}</div>
                <div className="text-sm text-primary">💡 {t.tradeAdvice}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.extensionCandidates.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-muted mb-2">🌱 扩散候选（周边可能被带动）</div>
          <div className="space-y-2">
            {analysis.extensionCandidates.map((e, i) => (
              <div key={i} className="border border-border rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Tag color="green" variant="filled">
                    {e.concept}
                  </Tag>
                </div>
                <div className="text-sm text-muted mb-1">{e.reason}</div>
                {e.watchStocks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {e.watchStocks.map((s, j) => (
                      <Tag key={j} color="gold" variant="filled">
                        {s}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.riskFlags.length > 0 && (
        <div>
          <div className="text-sm text-muted mb-2">
            <WarningOutlined /> 风险提示
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {analysis.riskFlags.map((r, i) => (
              <li key={i} className="text-sm text-down">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function ThemeCard({ theme }: { theme: ThemeCluster }) {
  const inflowText = theme.mainNetInflow
    ? `${theme.mainNetInflow >= 0 ? "+" : ""}${(theme.mainNetInflow / 1e8).toFixed(1)}亿`
    : "-"
  const inflowColor = (theme.mainNetInflow ?? 0) >= 0 ? "text-up" : "text-down"

  return (
    <Card variant="borderless">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-semibold">{theme.name}</span>
            <Tag color={STAGE_COLOR[theme.stage]} variant="filled">
              {STAGE_LABEL[theme.stage]}
            </Tag>
            {theme.sectorChangePercent !== null && (
              <span className={theme.sectorChangePercent >= 0 ? "text-up" : "text-down"}>
                {theme.sectorChangePercent >= 0 ? "+" : ""}
                {theme.sectorChangePercent.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="text-sm text-muted flex gap-4">
            <span>涨停 {theme.limitUpCount}</span>
            <span>最高 {theme.maxConsecutive} 板</span>
            <span>炸板率 {theme.bustRate.toFixed(0)}%</span>
            <span>
              主力 <span className={inflowColor}>{inflowText}</span>
            </span>
            <span>封单 {(theme.totalSealAmount / 1e8).toFixed(1)}亿</span>
          </div>
        </div>
        <div className="w-32">
          <div className="text-xs text-muted mb-1">热度</div>
          <Progress
            percent={theme.strength}
            size="small"
            strokeColor={
              theme.strength >= 70
                ? "var(--trading-up)"
                : theme.strength >= 40
                  ? "#faad14"
                  : "var(--text-muted)"
            }
          />
        </div>
      </div>

      <TierRow label="👑 龙头" color="red" stocks={theme.tiers.leader} />
      {theme.tiers.highLevel.length > 0 && (
        <TierRow label="🔥 高度板" color="orange" stocks={theme.tiers.highLevel} />
      )}
      {theme.tiers.follower.length > 0 && (
        <TierRow label="🌱 跟风首板" color="blue" stocks={theme.tiers.follower} />
      )}
    </Card>
  )
}

function TierRow({
  label,
  color,
  stocks,
}: {
  label: string
  color: string
  stocks: LimitUpPoolStock[]
}) {
  if (stocks.length === 0) return null

  return (
    <div className="mb-2">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {stocks.map((s) => (
          <Link key={s.code} href={`/stock/${s.code}`}>
            <Tag color={color} variant="filled" className="cursor-pointer !m-0">
              <span className="font-medium">{s.name}</span>
              <span className="ml-1 opacity-80">
                {s.consecutiveBoards}板
                {s.bustCount > 0 && ` 炸${s.bustCount}`}
              </span>
              {s.sealAmount > 1e8 && (
                <span className="ml-1 opacity-80">封{(s.sealAmount / 1e8).toFixed(1)}亿</span>
              )}
            </Tag>
          </Link>
        ))}
      </div>
    </div>
  )
}

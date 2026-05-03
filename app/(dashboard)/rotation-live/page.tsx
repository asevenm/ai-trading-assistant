"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Segmented,
  Spin,
  Statistic,
  Switch,
  Tag,
} from "antd"
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons"
import { BoardHeatmap } from "@/components/rotation/BoardHeatmap"
import { EventStream, type RotationEventItem } from "@/components/rotation/EventStream"
import type { RadarBoard } from "@/components/rotation/StageMap"

interface LiveResponse {
  tradeDate: string
  timeSlot: string | null
  boards: RadarBoard[]
}

interface EventsResponse {
  tradeDate: string
  events: RotationEventItem[]
}

const POLL_INTERVAL_MS = 30_000

export default function RotationLivePage() {
  const { message } = App.useApp()
  const [industry, setIndustry] = useState<LiveResponse | null>(null)
  const [concept, setConcept] = useState<LiveResponse | null>(null)
  const [events, setEvents] = useState<RotationEventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshotting, setSnapshotting] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [eventFilter, setEventFilter] = useState<string>("ALL")
  const lastIndustryScores = useRef<Map<string, number>>(new Map())
  const lastConceptScores = useRef<Map<string, number>>(new Map())

  const fetchAll = useCallback(async () => {
    try {
      const [iRes, cRes, eRes] = await Promise.all([
        fetch("/api/rotation/live?boardType=INDUSTRY&limit=20", { cache: "no-store" }),
        fetch("/api/rotation/live?boardType=CONCEPT&limit=20", { cache: "no-store" }),
        fetch("/api/rotation/events?limit=50", { cache: "no-store" }),
      ])
      const [iJson, cJson, eJson] = await Promise.all([
        iRes.json() as Promise<LiveResponse>,
        cRes.json() as Promise<LiveResponse>,
        eRes.json() as Promise<EventsResponse>,
      ])

      // 保存上一次的分数用于高亮变化
      const newIndMap = new Map<string, number>()
      industry?.boards.forEach((b) => {
        newIndMap.set(`${b.boardType}:${b.boardId}`, b.strengthScore)
      })
      lastIndustryScores.current = newIndMap

      const newConMap = new Map<string, number>()
      concept?.boards.forEach((b) => {
        newConMap.set(`${b.boardType}:${b.boardId}`, b.strengthScore)
      })
      lastConceptScores.current = newConMap

      setIndustry(iJson)
      setConcept(cJson)
      setEvents(eJson.events ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [industry, concept])

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
        `快照完成 [${json.result?.timeSlot}] 行业 ${json.result?.industryCount} / 概念 ${json.result?.conceptCount}, 事件 ${json.result?.eventsCreated}`
      )
      await fetchAll()
    } catch (error) {
      message.error("快照失败：" + (error instanceof Error ? error.message : ""))
    } finally {
      setSnapshotting(false)
    }
  }, [fetchAll, message])

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchAll()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchAll])

  const filteredEvents =
    eventFilter === "ALL" ? events : events.filter((e) => e.eventType === eventFilter)

  const topMainline = (concept?.boards ?? []).slice(0, 5)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  const tradeDate = concept?.tradeDate ?? industry?.tradeDate ?? "-"
  const timeSlot = concept?.timeSlot ?? industry?.timeSlot ?? "-"

  return (
    <div>
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ThunderboltOutlined className="text-2xl text-primary" />
          <h1 className="text-2xl font-bold m-0">轮动实时监控</h1>
          <Tag color="blue" className="ml-2">
            {tradeDate} · {timeSlot}
          </Tag>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm">
            <span>自动刷新</span>
            <Switch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              checkedChildren={<PlayCircleOutlined />}
              unCheckedChildren={<PauseCircleOutlined />}
            />
            <span className="text-muted text-xs ml-1">每 30 秒</span>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>
            手动刷新
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={triggerSnapshot}
            loading={snapshotting}
          >
            采集快照
          </Button>
        </div>
      </div>

      {/* 顶部主线 Top 5 */}
      <Card variant="borderless" className="mb-4" title="🎯 当前主线 Top 5（概念板块按强度分排序）">
        {topMainline.length === 0 ? (
          <Empty description="暂无快照数据，请先点击「采集快照」" />
        ) : (
          <Row gutter={16}>
            {topMainline.map((b) => (
              <Col span={Math.floor(24 / topMainline.length)} key={b.boardId}>
                <Statistic
                  title={
                    <div className="flex items-center gap-2">
                      <span>{b.boardName}</span>
                      {b.stage && (
                        <Tag
                          color={
                            b.stage === "RISING"
                              ? "red"
                              : b.stage === "STARTING"
                                ? "green"
                                : b.stage === "DIVERGING"
                                  ? "orange"
                                  : "default"
                          }
                          variant="filled"
                          className="!m-0"
                        >
                          {b.stage === "RISING"
                            ? "🔥主升"
                            : b.stage === "STARTING"
                              ? "🟢启动"
                              : b.stage === "DIVERGING"
                                ? "⚠️分歧"
                                : "🔻退潮"}
                        </Tag>
                      )}
                    </div>
                  }
                  value={b.strengthScore}
                  precision={1}
                  suffix={
                    b.deltaScore !== null && b.deltaScore !== undefined ? (
                      <span
                        className={`text-sm ml-1 ${
                          b.deltaScore >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        Δ{b.deltaScore >= 0 ? "+" : ""}
                        {b.deltaScore.toFixed(0)}
                      </span>
                    ) : null
                  }
                />
                <div className="text-xs text-muted mt-1">
                  涨停 {b.limitUpCount} · 最高 {b.topStreak} 板 · 净流入{" "}
                  {(b.mainNetInflow / 1e8).toFixed(1)} 亿
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Row gutter={16}>
        {/* 左：行业热力 */}
        <Col xs={24} md={8}>
          <Card variant="borderless" title="🏭 行业板块热力">
            {industry && industry.boards.length > 0 ? (
              <BoardHeatmap
                title=""
                boards={industry.boards}
                previousScoreMap={lastIndustryScores.current}
                limit={20}
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>

        {/* 中：概念热力 */}
        <Col xs={24} md={9}>
          <Card variant="borderless" title="💡 概念板块热力">
            {concept && concept.boards.length > 0 ? (
              <BoardHeatmap
                title=""
                boards={concept.boards}
                previousScoreMap={lastConceptScores.current}
                limit={20}
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>

        {/* 右：事件流 */}
        <Col xs={24} md={7}>
          <Card
            variant="borderless"
            title={
              <div className="flex items-center justify-between gap-2">
                <span>📢 关键事件流</span>
                <Segmented
                  size="small"
                  value={eventFilter}
                  onChange={(v) => setEventFilter(String(v))}
                  options={[
                    { label: "全部", value: "ALL" },
                    { label: "🔥", value: "RISING_BREAKOUT" },
                    { label: "🟢", value: "STARTING_SIGNAL" },
                    { label: "⚠️", value: "LEADER_BROKEN" },
                    { label: "🔻", value: "FADING_SIGNAL" },
                  ]}
                />
              </div>
            }
            styles={{ body: { maxHeight: 600, overflowY: "auto" } }}
          >
            <EventStream
              events={filteredEvents}
              emptyHint={
                events.length === 0
                  ? "今日尚无事件，需要至少 2 个快照才会触发对比"
                  : "当前筛选条件下无事件"
              }
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

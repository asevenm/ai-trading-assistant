"use client"

import { Empty, Tag } from "antd"
import {
  AlertOutlined,
  FireOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons"
import type { ReactNode } from "react"

export interface RotationEventItem {
  id: string
  timestamp: string
  eventType: string
  boardType: string
  boardId: string
  boardName: string
  fromStage: string | null
  toStage: string | null
  payload: Record<string, unknown>
}

interface EventStreamProps {
  events: RotationEventItem[]
  emptyHint?: string
}

interface EventTypeMeta {
  label: string
  color: string
  icon: ReactNode
}

const EVENT_META: Record<string, EventTypeMeta> = {
  RISING_BREAKOUT: {
    label: "🔥 主升突破",
    color: "red",
    icon: <FireOutlined />,
  },
  STARTING_SIGNAL: {
    label: "🟢 启动信号",
    color: "green",
    icon: <RiseOutlined />,
  },
  LEADER_BROKEN: {
    label: "⚠️ 龙头炸板",
    color: "orange",
    icon: <WarningOutlined />,
  },
  FADING_SIGNAL: {
    label: "🔻 退潮信号",
    color: "default",
    icon: <ThunderboltOutlined />,
  },
  STAGE_CHANGE: {
    label: "阶段变化",
    color: "blue",
    icon: <AlertOutlined />,
  },
}

export function EventStream({ events, emptyHint = "暂无事件" }: EventStreamProps) {
  if (events.length === 0) {
    return <Empty description={emptyHint} />
  }

  return (
    <div className="space-y-2">
      {events.map((e) => {
        const meta = EVENT_META[e.eventType] ?? {
          label: e.eventType,
          color: "default",
          icon: <AlertOutlined />,
        }
        const time = new Date(e.timestamp).toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })

        return (
          <div key={e.id} className="border-l-2 border-border pl-2 py-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted">{time}</span>
              <Tag color={meta.color} variant="filled" className="!m-0">
                {meta.icon} {meta.label}
              </Tag>
              <span className="font-medium">{e.boardName}</span>
              <span className="text-muted text-[10px]">
                {e.boardType === "INDUSTRY" ? "行业" : "概念"}
              </span>
            </div>
            {e.fromStage && e.toStage && e.fromStage !== e.toStage && (
              <div className="text-[11px] text-muted mt-0.5 ml-1">
                {stageText(e.fromStage)} → {stageText(e.toStage)}
              </div>
            )}
            {renderPayload(e.payload)}
          </div>
        )
      })}
    </div>
  )
}

function stageText(s: string): string {
  return (
    {
      STARTING: "启动",
      RISING: "主升",
      DIVERGING: "分歧",
      FADING: "退潮",
    }[s] ?? s
  )
}

function renderPayload(payload: Record<string, unknown>): ReactNode {
  const score = payload.currentScore as number | undefined
  const prev = payload.previousScore as number | undefined
  const delta = payload.deltaScore as number | undefined
  const limitUps = payload.limitUpCount as number | undefined
  const streak = payload.topStreak as number | undefined
  const leaders = payload.leaderStocks as string[] | undefined

  const parts: string[] = []
  if (score !== undefined) {
    if (prev !== undefined) parts.push(`S: ${prev.toFixed(0)} → ${score.toFixed(0)}`)
    else parts.push(`S=${score.toFixed(0)}`)
  }
  if (delta !== undefined && delta !== null) parts.push(`Δ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}`)
  if (limitUps !== undefined) parts.push(`涨停${limitUps}`)
  if (streak !== undefined && streak > 0) parts.push(`最高${streak}板`)

  if (parts.length === 0 && (!leaders || leaders.length === 0)) return null

  return (
    <div className="text-[11px] text-muted ml-1 mt-0.5">
      {parts.join(" · ")}
      {leaders && leaders.length > 0 && (
        <span className="ml-2">龙头: {leaders.join(", ")}</span>
      )}
    </div>
  )
}

"use client"

import { Empty, Tag } from "antd"
import Link from "next/link"
import type { RadarBoard } from "./StageMap"

const STAGE_COLOR: Record<string, string> = {
  STARTING: "green",
  RISING: "red",
  DIVERGING: "orange",
  FADING: "default",
}

const STAGE_LABEL: Record<string, string> = {
  STARTING: "🟢 启动",
  RISING: "🔥 主升",
  DIVERGING: "⚠️ 分歧",
  FADING: "🔻 退潮",
}

export function BoardStageList({ boards }: { boards: RadarBoard[] }) {
  if (boards.length === 0) {
    return <Empty description="暂无评级数据" />
  }

  // 按阶段分组（未入选放最后）
  const order = ["RISING", "STARTING", "DIVERGING", "FADING", "UNCATEGORIZED"]
  const grouped = new Map<string, RadarBoard[]>()
  for (const b of boards) {
    const key = b.stage ?? "UNCATEGORIZED"
    const list = grouped.get(key) ?? []
    grouped.set(key, [...list, b])
  }

  return (
    <div className="space-y-4">
      {order.map((stage) => {
        const list = grouped.get(stage)
        if (!list || list.length === 0) return null
        return (
          <div key={stage}>
            <div className="text-sm font-semibold mb-2">
              {STAGE_LABEL[stage] ?? "未入选"}{" "}
              <span className="text-muted font-normal">({list.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {list
                .sort((a, b) => b.strengthScore - a.strengthScore)
                .map((b) => (
                  <Link key={b.boardId} href={`/sector/${b.boardId}`}>
                    <Tag
                      color={STAGE_COLOR[stage] ?? "default"}
                      variant="filled"
                      className="cursor-pointer !m-0"
                    >
                      <span className="font-medium">{b.boardName}</span>
                      <span className="ml-1 opacity-80">
                        S={b.strengthScore.toFixed(0)}
                        {b.deltaScore !== null &&
                          ` Δ${b.deltaScore >= 0 ? "+" : ""}${b.deltaScore.toFixed(0)}`}
                      </span>
                    </Tag>
                  </Link>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

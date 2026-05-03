"use client"

import type { RadarBoard } from "./StageMap"

const STAGE_COLOR: Record<string, string> = {
  STARTING: "#22c55e",
  RISING: "#ef4444",
  DIVERGING: "#f59e0b",
  FADING: "#6b7280",
}

const STAGE_LABEL: Record<string, string> = {
  STARTING: "启动",
  RISING: "主升",
  DIVERGING: "分歧",
  FADING: "退潮",
}

interface BoardHeatmapProps {
  title: string
  boards: RadarBoard[]
  /** 上一快照的相同板块 score map（用于显示 ΔS 高亮） */
  previousScoreMap?: Map<string, number>
  /** 仅显示 Top N 行 */
  limit?: number
}

/**
 * 单列热力柱状图：每个板块一行，长度=strengthScore，颜色=stage
 * 右侧标注 ΔS（势头）和涨停数
 */
export function BoardHeatmap({
  title,
  boards,
  previousScoreMap,
  limit = 20,
}: BoardHeatmapProps) {
  const sliced = boards.slice(0, limit)

  return (
    <div>
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="space-y-1">
        {sliced.map((b) => {
          const prevScore = previousScoreMap?.get(`${b.boardType}:${b.boardId}`)
          const surge =
            prevScore !== undefined && b.strengthScore - prevScore >= 5
          const stageColor = b.stage ? STAGE_COLOR[b.stage] : "#cbd5e1"

          return (
            <div
              key={b.boardId}
              className={`flex items-center gap-2 text-xs ${surge ? "ring-1 ring-yellow-400 rounded" : ""}`}
            >
              <div className="w-24 truncate" title={b.boardName}>
                {b.boardName}
              </div>
              <div className="flex-1 relative h-5 bg-[var(--bg-elevated,#f1f5f9)] rounded overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${b.strengthScore}%`,
                    backgroundColor: stageColor,
                    opacity: 0.85,
                  }}
                />
                <div className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-white mix-blend-difference">
                  {b.strengthScore.toFixed(0)}
                  {b.stage && (
                    <span className="ml-1 opacity-90">· {STAGE_LABEL[b.stage]}</span>
                  )}
                </div>
              </div>
              <div className="w-14 text-right text-muted">
                {b.deltaScore !== null && b.deltaScore !== undefined
                  ? `${b.deltaScore >= 0 ? "+" : ""}${b.deltaScore.toFixed(0)}`
                  : "-"}
              </div>
              <div className="w-10 text-right">
                {b.limitUpCount > 0 ? `${b.limitUpCount}板` : "-"}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { useMemo } from "react"
import ReactECharts from "echarts-for-react"

export interface RadarBoard {
  boardId: string
  boardName: string
  boardType: "INDUSTRY" | "CONCEPT"
  strengthScore: number
  deltaScore: number | null
  accelScore: number | null
  stage: string | null
  stageReason: string | null
  changePct: number
  limitUpCount: number
  mainNetInflow: number
  topStreak: number
  turnoverRate: number
  leaderStocks: string[]
}

interface StageMapProps {
  boards: RadarBoard[]
  onSelect?: (board: RadarBoard) => void
}

const STAGE_COLOR: Record<string, string> = {
  STARTING: "#22c55e", // 启动 绿
  RISING: "#ef4444", // 主升 红（A股涨色）
  DIVERGING: "#f59e0b", // 分歧 橙
  FADING: "#6b7280", // 退潮 灰
}

const STAGE_LABEL: Record<string, string> = {
  STARTING: "启动",
  RISING: "主升",
  DIVERGING: "分歧",
  FADING: "退潮",
}

export function StageMap({ boards, onSelect }: StageMapProps) {
  const option = useMemo(() => {
    // 按 stage 分组成不同 series（图例可点击切换）
    const seriesByStage: Record<string, RadarBoard[]> = {
      STARTING: [],
      RISING: [],
      DIVERGING: [],
      FADING: [],
      UNCATEGORIZED: [],
    }

    for (const b of boards) {
      const key = b.stage ?? "UNCATEGORIZED"
      if (seriesByStage[key]) {
        seriesByStage[key].push(b)
      } else {
        seriesByStage.UNCATEGORIZED.push(b)
      }
    }

    // 主力净流入 → 气泡大小（绝对值；min 8 / max 50 px）
    const inflows = boards.map((b) => Math.abs(b.mainNetInflow))
    const maxInflow = Math.max(...inflows, 1)
    const sizeOf = (v: number) => 8 + (Math.abs(v) / maxInflow) * 42

    const buildSeries = (stageKey: string, items: RadarBoard[]) => ({
      name: STAGE_LABEL[stageKey] ?? "未入选",
      type: "scatter" as const,
      symbolSize: (data: unknown) => {
        const arr = data as number[]
        return arr[2] ?? 10
      },
      data: items.map((b) => ({
        value: [b.deltaScore ?? 0, b.strengthScore, sizeOf(b.mainNetInflow), b.boardName],
        boardId: b.boardId,
        boardType: b.boardType,
        raw: b,
      })),
      itemStyle: {
        color: stageKey === "UNCATEGORIZED" ? "#cbd5e1" : STAGE_COLOR[stageKey],
        opacity: 0.85,
        borderColor: "#fff",
        borderWidth: 1,
      },
      label: {
        show: items.length <= 30, // 太多点就不显示标签避免重叠
        position: "right" as const,
        formatter: (p: unknown) => {
          const param = p as { value?: (number | string)[] }
          return String(param.value?.[3] ?? "")
        },
        fontSize: 10,
      },
      emphasis: {
        focus: "series" as const,
        label: { show: true },
      },
    })

    return {
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const param = p as { data?: { raw?: RadarBoard } }
          const b = param.data?.raw
          if (!b) return ""
          const inflow = (b.mainNetInflow / 1e8).toFixed(2)
          return `
            <div style="font-weight:600;margin-bottom:4px">${b.boardName}</div>
            <div>强度分 S: <b>${b.strengthScore.toFixed(1)}</b></div>
            <div>ΔS: <b>${b.deltaScore?.toFixed(1) ?? "-"}</b> (势头)</div>
            <div>Δ²S: <b>${b.accelScore?.toFixed(1) ?? "-"}</b> (加速度)</div>
            <div>阶段: <b>${b.stage ? STAGE_LABEL[b.stage] : "未入选"}</b></div>
            <hr style="margin:4px 0;border-color:#eee">
            <div>板块涨幅: ${b.changePct.toFixed(2)}%</div>
            <div>涨停数: ${b.limitUpCount} / 最高 ${b.topStreak} 板</div>
            <div>主力净流入: ${inflow} 亿</div>
            ${b.stageReason ? `<div style="color:#888;margin-top:4px">${b.stageReason}</div>` : ""}
          `
        },
      },
      legend: {
        data: ["启动", "主升", "分歧", "退潮", "未入选"],
        top: 0,
      },
      grid: {
        left: "10%",
        right: "10%",
        top: 50,
        bottom: 50,
      },
      xAxis: {
        name: "ΔS（势头：今日 vs 上一快照）",
        nameLocation: "middle",
        nameGap: 30,
        type: "value",
        splitLine: { lineStyle: { color: "#e5e7eb" } },
        axisLine: { onZero: true },
      },
      yAxis: {
        name: "强度分 S（0-100）",
        type: "value",
        min: 0,
        max: 100,
        splitLine: { lineStyle: { color: "#e5e7eb" } },
      },
      series: [
        buildSeries("STARTING", seriesByStage.STARTING),
        buildSeries("RISING", seriesByStage.RISING),
        buildSeries("DIVERGING", seriesByStage.DIVERGING),
        buildSeries("FADING", seriesByStage.FADING),
        buildSeries("UNCATEGORIZED", seriesByStage.UNCATEGORIZED),
      ],
    }
  }, [boards])

  return (
    <ReactECharts
      option={option}
      style={{ height: 520, width: "100%" }}
      notMerge
      onEvents={{
        click: (params: unknown) => {
          const p = params as { data?: { raw?: RadarBoard } }
          const board = p.data?.raw
          if (board && onSelect) onSelect(board)
        },
      }}
    />
  )
}

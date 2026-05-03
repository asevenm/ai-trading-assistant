"use client"

import { useEffect, useState, useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { Segmented, Tag } from "antd"
import type { CapitalFlowPoint, CapitalFlowSummary } from "@/lib/level2-api"

interface CapitalFlowChartProps {
  code: string
}

function formatFlowAmount(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "--"
  const abs = Math.abs(v)
  if (abs >= 1e7) return (v / 1e8).toFixed(2) + "亿"
  if (abs >= 1e4) return (v / 1e4).toFixed(0) + "万"
  return v.toFixed(0)
}

export function CapitalFlowChart({ code }: CapitalFlowChartProps) {
  const [points, setPoints] = useState<CapitalFlowPoint[]>([])
  const [summary, setSummary] = useState<CapitalFlowSummary | null>(null)
  const [mode, setMode] = useState<"main" | "detail">("main")

  const fetchData = async (signal: AbortSignal) => {
    try {
      const [intradayRes, summaryRes] = await Promise.all([
        fetch(`/api/level2?action=capital-intraday&code=${code}`, { signal }),
        fetch(`/api/level2?action=capital-summary&code=${code}`, { signal }),
      ])
      if (intradayRes.ok) {
        const data = await intradayRes.json()
        if (Array.isArray(data)) setPoints(data)
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json()
        if (data) setSummary(data)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    const interval = setInterval(() => fetchData(controller.signal), 15000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const option = useMemo(() => {
    if (points.length === 0) return {}

    const times = points.map((p) => {
      const t = p.time
      return t.includes(" ") ? t.split(" ")[1]?.slice(0, 5) : t.slice(0, 5)
    })

    if (mode === "main") {
      // 主力净流入累计曲线
      const mainCum: number[] = []
      let cum = 0
      for (const p of points) {
        cum += p.mainNet
        mainCum.push(cum)
      }

      return {
        animation: false,
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(20,20,20,0.95)",
          borderColor: "#262626",
          textStyle: { color: "#ededed", fontSize: 12 },
          formatter: (params: Array<{ dataIndex: number }>) => {
            const idx = params[0]?.dataIndex
            if (idx == null) return ""
            const p = points[idx]
            return `
              <div style="font-size:12px;line-height:1.8">
                <div style="font-weight:600">${times[idx]}</div>
                <div>主力净流入: <span style="color:${p.mainNet >= 0 ? "#ef4444" : "#22c55e"}">${formatFlowAmount(p.mainNet)}</span></div>
                <div>累计: <span style="color:${mainCum[idx] >= 0 ? "#ef4444" : "#22c55e"}">${formatFlowAmount(mainCum[idx])}</span></div>
              </div>
            `
          },
        },
        grid: { left: 60, right: 20, top: 20, bottom: 30 },
        xAxis: {
          type: "category",
          data: times,
          axisLine: { lineStyle: { color: "#262626" } },
          axisLabel: { color: "#a1a1a1", fontSize: 10 },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          axisLine: { show: false },
          splitLine: { lineStyle: { color: "#1c1c1c" } },
          axisLabel: {
            color: "#a1a1a1",
            fontSize: 10,
            formatter: (v: number) => formatFlowAmount(v),
          },
        },
        series: [
          {
            name: "主力净流入累计",
            type: "line",
            data: mainCum,
            smooth: true,
            showSymbol: false,
            areaStyle: {
              color: {
                type: "linear",
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: "rgba(239,68,68,0.3)" },
                  { offset: 0.5, color: "rgba(239,68,68,0)" },
                  { offset: 0.5, color: "rgba(34,197,94,0)" },
                  { offset: 1, color: "rgba(34,197,94,0.3)" },
                ],
              },
            },
            lineStyle: { color: "#f59e0b", width: 2 },
            itemStyle: { color: "#f59e0b" },
          },
        ],
      }
    }

    // 详细模式: 超大单+大单+中单+小单 分时
    return {
      animation: false,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(20,20,20,0.95)",
        borderColor: "#262626",
        textStyle: { color: "#ededed", fontSize: 12 },
      },
      legend: {
        data: ["超大单", "大单", "中单", "小单"],
        textStyle: { color: "#a1a1a1", fontSize: 11 },
        top: 0,
      },
      grid: { left: 60, right: 20, top: 30, bottom: 30 },
      xAxis: {
        type: "category",
        data: times,
        axisLine: { lineStyle: { color: "#262626" } },
        axisLabel: { color: "#a1a1a1", fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#1c1c1c" } },
        axisLabel: {
          color: "#a1a1a1",
          fontSize: 10,
          formatter: (v: number) => formatFlowAmount(v),
        },
      },
      series: [
        {
          name: "超大单",
          type: "bar",
          stack: "flow",
          data: points.map((p) => p.superNet),
          itemStyle: { color: "#ef4444" },
        },
        {
          name: "大单",
          type: "bar",
          stack: "flow",
          data: points.map((p) => p.bigNet),
          itemStyle: { color: "#f97316" },
        },
        {
          name: "中单",
          type: "bar",
          stack: "flow",
          data: points.map((p) => p.midNet),
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "小单",
          type: "bar",
          stack: "flow",
          data: points.map((p) => p.smallNet),
          itemStyle: { color: "#22c55e" },
        },
      ],
    }
  }, [points, mode])

  return (
    <div>
      {/* 概况 */}
      {summary && (
        <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
          {[
            { label: "主力", net: summary.mainNet, pct: summary.mainNetPct, color: "#ef4444" },
            { label: "超大单", net: summary.superNet, pct: summary.superNetPct, color: "#ef4444" },
            { label: "大单", net: summary.bigNet, pct: summary.bigNetPct, color: "#f97316" },
            { label: "中单", net: summary.midNet, pct: summary.midNetPct, color: "#3b82f6" },
            { label: "小单", net: summary.smallNet, pct: summary.smallNetPct, color: "#22c55e" },
          ].map((item) => {
            const net = item.net ?? 0
            const pct = item.pct ?? 0
            return (
            <div key={item.label} className="text-center">
              <div className="text-muted-foreground mb-0.5">{item.label}</div>
              <div className={net >= 0 ? "text-up" : "text-down"}>
                {formatFlowAmount(net)}
              </div>
              <Tag
                color={net >= 0 ? "red" : "green"}
                className="!text-[10px] !px-1 !py-0 !m-0 !mt-0.5"
              >
                {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
              </Tag>
            </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <Segmented
          size="small"
          options={[
            { label: "主力趋势", value: "main" },
            { label: "分类明细", value: "detail" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "main" | "detail")}
        />
      </div>

      {points.length === 0 ? (
        <div className="flex justify-center items-center h-[240px] text-muted-foreground">
          暂无资金流向数据
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: 240 }}
          notMerge
          lazyUpdate
        />
      )}
    </div>
  )
}

"use client"

import { useEffect, useState, useMemo } from "react"
import ReactECharts from "echarts-for-react"
import type { CapitalFlowDayItem } from "@/lib/level2-api"

interface MainCapitalLineProps {
  code: string
}

function formatAmount(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "--"
  const abs = Math.abs(v)
  if (abs >= 1e7) return (v / 1e8).toFixed(2) + "亿"
  if (abs >= 1e4) return (v / 1e4).toFixed(0) + "万"
  return v.toFixed(0)
}

export function MainCapitalLine({ code }: MainCapitalLineProps) {
  const [data, setData] = useState<CapitalFlowDayItem[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/level2?action=capital-history&code=${code}&days=30`)
        if (!res.ok) return
        const json = await res.json()
        if (Array.isArray(json)) setData(json)
      } catch {
        // ignore
      }
    }
    fetchData()
  }, [code])

  const option = useMemo(() => {
    if (data.length === 0) return {}

    const dates = data.map((d) => d.date.slice(5))

    // 累计主力净流入
    const cumMain: number[] = []
    let cum = 0
    for (const d of data) {
      cum += d.mainNet
      cumMain.push(cum)
    }

    // 每日主力净流入柱状图
    const dailyColors = data.map((d) =>
      d.mainNet >= 0 ? "rgba(239,68,68,0.7)" : "rgba(34,197,94,0.7)"
    )

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
          if (idx == null || !data[idx]) return ""
          const d = data[idx]
          return `
            <div style="font-size:12px;line-height:1.8">
              <div style="font-weight:600">${d.date}</div>
              <div>当日主力: <span style="color:${d.mainNet >= 0 ? "#ef4444" : "#22c55e"}">${formatAmount(d.mainNet)}</span></div>
              <div>累计主力: <span style="color:${cumMain[idx] >= 0 ? "#ef4444" : "#22c55e"}">${formatAmount(cumMain[idx])}</span></div>
              <div>超大单: <span style="color:${d.superNet >= 0 ? "#ef4444" : "#22c55e"}">${formatAmount(d.superNet)}</span></div>
              <div>大单: <span style="color:${d.bigNet >= 0 ? "#ef4444" : "#22c55e"}">${formatAmount(d.bigNet)}</span></div>
            </div>
          `
        },
      },
      legend: {
        data: ["每日净流入", "累计净流入"],
        textStyle: { color: "#a1a1a1", fontSize: 11 },
        top: 0,
      },
      grid: { left: 60, right: 60, top: 30, bottom: 30 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: "#262626" } },
        axisLabel: { color: "#a1a1a1", fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "每日",
          nameTextStyle: { color: "#a1a1a1", fontSize: 10 },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: "#1c1c1c" } },
          axisLabel: {
            color: "#a1a1a1",
            fontSize: 10,
            formatter: (v: number) => formatAmount(v),
          },
        },
        {
          type: "value",
          name: "累计",
          nameTextStyle: { color: "#a1a1a1", fontSize: 10 },
          position: "right",
          axisLine: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: "#a1a1a1",
            fontSize: 10,
            formatter: (v: number) => formatAmount(v),
          },
        },
      ],
      series: [
        {
          name: "每日净流入",
          type: "bar",
          data: data.map((d, i) => ({
            value: d.mainNet,
            itemStyle: { color: dailyColors[i] },
          })),
          yAxisIndex: 0,
        },
        {
          name: "累计净流入",
          type: "line",
          data: cumMain,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: "#f59e0b", width: 2 },
          itemStyle: { color: "#f59e0b" },
          yAxisIndex: 1,
        },
      ],
    }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="flex justify-center items-center h-[240px] text-muted-foreground">
        暂无主力资金历史数据
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 280 }}
      notMerge
      lazyUpdate
    />
  )
}

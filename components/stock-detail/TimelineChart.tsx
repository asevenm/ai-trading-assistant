"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { Spin } from "antd";
import type { TimelineData } from "@/lib/stock-api";

interface TimelineChartProps {
  code: string;
}

// A股交易时段: 09:30-11:30, 13:00-15:00 共 240 分钟
const TRADING_TICKS = ["09:30", "10:00", "10:30", "11:00", "11:30/13:00", "13:30", "14:00", "14:30", "15:00"];

export function TimelineChart({ code }: TimelineChartProps) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock-data?action=timeline&code=${code}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 15000);
    return () => clearInterval(interval);
  }, [fetchTimeline]);

  const option = useMemo(() => {
    if (!data || data.points.length === 0) return {};

    const { preClose, points } = data;
    const times = points.map((p) => {
      const t = p.time.split(" ")[1] || p.time;
      return t.slice(0, 5);
    });
    const prices = points.map((p) => p.price);
    const avgPrices = points.map((p) => p.avgPrice);
    const volumes = points.map((p) => p.volume);

    const allPrices = [...prices, preClose];
    const maxDiff = Math.max(
      Math.abs(Math.max(...allPrices) - preClose),
      Math.abs(Math.min(...allPrices) - preClose),
      preClose * 0.005
    );
    const yMin = preClose - maxDiff * 1.05;
    const yMax = preClose + maxDiff * 1.05;

    const volumeColors = points.map((p) =>
      p.price >= preClose ? "rgba(239,68,68,0.5)" : "rgba(34,197,94,0.5)"
    );

    return {
      animation: false,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: "rgba(20,20,20,0.95)",
        borderColor: "#262626",
        textStyle: { color: "#ededed", fontSize: 12 },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const idx = params[0]?.dataIndex;
          if (idx == null || !points[idx]) return "";
          const p = points[idx];
          const change = p.price - preClose;
          const changePct = (change / preClose) * 100;
          const color = change >= 0 ? "#ef4444" : "#22c55e";
          return `
            <div style="font-size:12px;line-height:1.8">
              <div style="font-weight:600;margin-bottom:2px">${times[idx]}</div>
              <div>价格 <span style="color:${color};float:right;margin-left:12px">${p.price.toFixed(2)}</span></div>
              <div>均价 <span style="color:#f59e0b;float:right;margin-left:12px">${p.avgPrice.toFixed(2)}</span></div>
              <div>涨跌 <span style="color:${color};float:right;margin-left:12px">${change >= 0 ? "+" : ""}${change.toFixed(2)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)</span></div>
              <div>成交 <span style="float:right;margin-left:12px">${formatVol(p.volume)}</span></div>
            </div>
          `;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: [0, 1] }],
      },
      grid: [
        { left: 60, right: 60, top: 20, height: "55%" },
        { left: 60, right: 60, top: "72%", height: "18%" },
      ],
      xAxis: [
        {
          type: "category",
          data: times,
          gridIndex: 0,
          axisLine: { lineStyle: { color: "#262626" } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
        {
          type: "category",
          data: times,
          gridIndex: 1,
          axisLine: { lineStyle: { color: "#262626" } },
          axisTick: {
            alignWithLabel: true,
            interval: (index: number) => {
              const t = times[index];
              return TRADING_TICKS.some((tick) => t === tick || t === tick.split("/")[0]);
            },
          },
          axisLabel: {
            color: "#a1a1a1",
            fontSize: 10,
            interval: (_index: number, value: string) =>
              TRADING_TICKS.some((tick) => value === tick || value === tick.split("/")[0]),
            formatter: (v: string) => {
              if (v === "11:30") return "11:30/13:00";
              return v;
            },
          },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          position: "left",
          min: yMin,
          max: yMax,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#1c1c1c" } },
          axisLabel: {
            color: "#a1a1a1",
            fontSize: 10,
            formatter: (v: number) => v.toFixed(2),
          },
        },
        {
          type: "value",
          gridIndex: 0,
          position: "right",
          min: yMin,
          max: yMax,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: "#a1a1a1",
            fontSize: 10,
            formatter: (v: number) => {
              const pct = ((v - preClose) / preClose) * 100;
              return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
            },
          },
        },
        {
          type: "value",
          gridIndex: 1,
          position: "left",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: "#a1a1a1",
            fontSize: 10,
            formatter: (v: number) => formatVol(v),
          },
        },
      ],
      series: [
        {
          name: "价格",
          type: "line",
          data: prices,
          xAxisIndex: 0,
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { width: 1.5, color: "#3b82f6" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(59,130,246,0.15)" },
                { offset: 1, color: "rgba(59,130,246,0)" },
              ],
            },
          },
        },
        {
          name: "均价",
          type: "line",
          data: avgPrices,
          xAxisIndex: 0,
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { width: 1, color: "#f59e0b", type: "dashed" },
        },
        {
          name: "昨收",
          type: "line",
          data: times.map(() => preClose),
          xAxisIndex: 0,
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { width: 1, color: "#a1a1a1", type: "dotted" },
        },
        {
          name: "成交量",
          type: "bar",
          data: volumes.map((v, i) => ({
            value: v,
            itemStyle: { color: volumeColors[i] },
          })),
          xAxisIndex: 1,
          yAxisIndex: 2,
        },
      ],
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-[400px]">
        <Spin />
      </div>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <div className="flex justify-center items-center h-[400px] text-muted-foreground">
        暂无分时数据
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 400 }}
      notMerge
      lazyUpdate
    />
  );
}

function formatVol(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + "亿";
  if (v >= 1e4) return (v / 1e4).toFixed(0) + "万";
  return String(v);
}

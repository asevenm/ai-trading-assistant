"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { Segmented, Spin } from "antd";
import type { KlineItem, KlinePeriod } from "@/lib/stock-api";
import { calculateMA } from "@/lib/indicators";
import { TimelineChart } from "./TimelineChart";

interface KlineChartProps {
  code: string;
}

type ChartMode = "timeline" | KlinePeriod;

const MODE_OPTIONS = [
  { label: "分时", value: "timeline" as ChartMode },
  { label: "日K", value: "daily" as ChartMode },
  { label: "周K", value: "weekly" as ChartMode },
  { label: "月K", value: "monthly" as ChartMode },
];

const MA_COLORS: Record<string, string> = {
  MA5: "#f59e0b",
  MA10: "#3b82f6",
  MA20: "#a855f6",
  MA60: "#06b6d4",
};

export function KlineChart({ code }: KlineChartProps) {
  const [data, setData] = useState<KlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ChartMode>("timeline");

  const isTimeline = mode === "timeline";

  const fetchKline = useCallback(async () => {
    if (isTimeline) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stock-data?action=kline&code=${code}&period=${mode}&limit=120`
      );
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [code, mode, isTimeline]);

  useEffect(() => {
    if (!isTimeline) {
      fetchKline();
    }
  }, [fetchKline, isTimeline]);

  const option = useMemo(() => {
    if (data.length === 0) return {};

    const dates = data.map((d) => d.date);
    const closes = data.map((d) => d.close);
    const volumes = data.map((d) => d.volume);

    const ma5 = calculateMA(closes, 5);
    const ma10 = calculateMA(closes, 10);
    const ma20 = calculateMA(closes, 20);
    const ma60 = calculateMA(closes, 60);

    const candlestickData = data.map((d) => [d.open, d.close, d.low, d.high]);

    const volumeColors = data.map((d) =>
      d.close >= d.open ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.6)"
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
        formatter: (params: Array<{ seriesName: string; value: number | number[]; dataIndex: number }>) => {
          const idx = params[0]?.dataIndex;
          if (idx == null || !data[idx]) return "";
          const d = data[idx];
          const color = d.close >= d.open ? "#ef4444" : "#22c55e";
          return `
            <div style="font-size:12px;line-height:1.8">
              <div style="font-weight:600;margin-bottom:2px">${d.date}</div>
              <div>开盘 <span style="color:${color};float:right;margin-left:12px">${d.open.toFixed(2)}</span></div>
              <div>收盘 <span style="color:${color};float:right;margin-left:12px">${d.close.toFixed(2)}</span></div>
              <div>最高 <span style="color:#ef4444;float:right;margin-left:12px">${d.high.toFixed(2)}</span></div>
              <div>最低 <span style="color:#22c55e;float:right;margin-left:12px">${d.low.toFixed(2)}</span></div>
              <div>涨跌 <span style="color:${color};float:right;margin-left:12px">${d.changePercent >= 0 ? "+" : ""}${d.changePercent.toFixed(2)}%</span></div>
              <div>成交量 <span style="float:right;margin-left:12px">${formatVol(d.volume)}</span></div>
            </div>
          `;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: [0, 1] }],
      },
      grid: [
        { left: 60, right: 20, top: 30, height: "55%" },
        { left: 60, right: 20, top: "72%", height: "18%" },
      ],
      xAxis: [
        {
          type: "category",
          data: dates,
          gridIndex: 0,
          axisLine: { lineStyle: { color: "#262626" } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
        {
          type: "category",
          data: dates,
          gridIndex: 1,
          axisLine: { lineStyle: { color: "#262626" } },
          axisTick: { show: false },
          axisLabel: {
            color: "#a1a1a1",
            fontSize: 10,
            formatter: (v: string) => v.slice(5),
          },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          position: "left",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#1c1c1c" } },
          axisLabel: { color: "#a1a1a1", fontSize: 10 },
          scale: true,
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
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
          start: 60,
          end: 100,
        },
      ],
      series: [
        {
          name: "K线",
          type: "candlestick",
          data: candlestickData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: "#ef4444",
            color0: "#22c55e",
            borderColor: "#ef4444",
            borderColor0: "#22c55e",
          },
        },
        {
          name: "MA5",
          type: "line",
          data: ma5,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: MA_COLORS.MA5 },
        },
        {
          name: "MA10",
          type: "line",
          data: ma10,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: MA_COLORS.MA10 },
        },
        {
          name: "MA20",
          type: "line",
          data: ma20,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: MA_COLORS.MA20 },
        },
        {
          name: "MA60",
          type: "line",
          data: ma60,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: MA_COLORS.MA60 },
        },
        {
          name: "成交量",
          type: "bar",
          data: volumes.map((v, i) => ({
            value: v,
            itemStyle: { color: volumeColors[i] },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
      ],
    };
  }, [data]);

  return (
    <div className="bg-card rounded-lg border border-border mb-6 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <Segmented
            size="small"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(v) => setMode(v as ChartMode)}
          />
          {!isTimeline && (
            <div className="flex items-center gap-3 text-xs">
              {Object.entries(MA_COLORS).map(([name, color]) => (
                <span key={name} style={{ color }}>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {isTimeline ? (
        <TimelineChart code={code} />
      ) : loading ? (
        <div className="flex justify-center items-center h-[400px]">
          <Spin />
        </div>
      ) : data.length === 0 ? (
        <div className="flex justify-center items-center h-[400px] text-muted-foreground">
          暂无K线数据
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: 400 }}
          notMerge
          lazyUpdate
        />
      )}
    </div>
  );
}

function formatVol(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + "亿";
  if (v >= 1e4) return (v / 1e4).toFixed(0) + "万";
  return String(v);
}

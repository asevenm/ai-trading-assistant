"use client"

import { useEffect, useState } from "react"
import type { OrderBookData } from "@/lib/level2-api"
import { formatPrice } from "@/lib/utils"

interface OrderBookProps {
  code: string
}

export function OrderBook({ code }: OrderBookProps) {
  const [data, setData] = useState<OrderBookData | null>(null)

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/level2?action=orderbook&code=${code}`)
      if (!res.ok) return
      const json = await res.json()
      if (json) setData(json)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (!data) {
    return <div className="text-center text-muted-foreground py-4">加载盘口...</div>
  }

  const allVolumes = [...data.asks, ...data.bids]
    .map((l) => l.volume)
    .filter((v) => v > 0)
  const maxVolume = Math.max(...allVolumes, 1)

  return (
    <div className="text-sm font-mono">
      {/* 卖盘 (从卖5到卖1，倒序显示) */}
      <div className="space-y-0.5 mb-2">
        {[...data.asks].reverse().map((ask, i) => {
          const level = 5 - i
          const pct = maxVolume > 0 ? (ask.volume / maxVolume) * 100 : 0
          const isUp = ask.price > data.prevClose
          const isDown = ask.price < data.prevClose
          return (
            <div key={`ask-${level}`} className="relative flex items-center h-7">
              <div
                className="absolute right-0 top-0 h-full bg-green-500/10"
                style={{ width: `${pct}%` }}
              />
              <span className="relative z-10 w-10 text-muted-foreground text-xs">
                卖{level}
              </span>
              <span
                className={`relative z-10 flex-1 ${
                  isUp ? "text-up" : isDown ? "text-down" : "text-foreground"
                }`}
              >
                {ask.price > 0 ? formatPrice(ask.price) : "--"}
              </span>
              <span className="relative z-10 text-right w-20 text-muted-foreground">
                {ask.volume > 0 ? ask.volume : "--"}
              </span>
            </div>
          )
        })}
      </div>

      {/* 当前价 */}
      <div className="flex items-center justify-center py-2 border-y border-border my-1">
        <span
          className={`text-lg font-bold ${
            data.currentPrice > data.prevClose
              ? "text-up"
              : data.currentPrice < data.prevClose
              ? "text-down"
              : "text-foreground"
          }`}
        >
          {formatPrice(data.currentPrice)}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          {data.prevClose > 0
            ? `${(
                ((data.currentPrice - data.prevClose) / data.prevClose) *
                100
              ).toFixed(2)}%`
            : ""}
        </span>
      </div>

      {/* 买盘 (买1到买5) */}
      <div className="space-y-0.5 mt-2">
        {data.bids.map((bid, i) => {
          const level = i + 1
          const pct = maxVolume > 0 ? (bid.volume / maxVolume) * 100 : 0
          const isUp = bid.price > data.prevClose
          const isDown = bid.price < data.prevClose
          return (
            <div key={`bid-${level}`} className="relative flex items-center h-7">
              <div
                className="absolute right-0 top-0 h-full bg-red-500/10"
                style={{ width: `${pct}%` }}
              />
              <span className="relative z-10 w-10 text-muted-foreground text-xs">
                买{level}
              </span>
              <span
                className={`relative z-10 flex-1 ${
                  isUp ? "text-up" : isDown ? "text-down" : "text-foreground"
                }`}
              >
                {bid.price > 0 ? formatPrice(bid.price) : "--"}
              </span>
              <span className="relative z-10 text-right w-20 text-muted-foreground">
                {bid.volume > 0 ? bid.volume : "--"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import type { TransactionItem } from "@/lib/level2-api"
import { formatPrice } from "@/lib/utils"

interface TransactionListProps {
  code: string
}

export function TransactionList({ code }: TransactionListProps) {
  const [data, setData] = useState<TransactionItem[]>([])

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/level2?action=transactions&code=${code}&pos=-50`)
      if (!res.ok) return
      const json = await res.json()
      if (Array.isArray(json)) setData(json)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (data.length === 0) {
    return <div className="text-center text-muted-foreground py-4">暂无成交数据</div>
  }

  return (
    <div className="text-xs font-mono">
      <div className="flex items-center border-b border-border pb-1 mb-1 text-muted-foreground">
        <span className="w-16">时间</span>
        <span className="flex-1 text-right">价格</span>
        <span className="w-16 text-right">成交(手)</span>
        <span className="w-10 text-right">方向</span>
      </div>
      <div className="max-h-[360px] overflow-y-auto space-y-0.5">
        {[...data].reverse().map((tx, i) => {
          const colorClass =
            tx.type === "buy" ? "text-up" : tx.type === "sell" ? "text-down" : "text-foreground"
          const dirLabel = tx.type === "buy" ? "买" : tx.type === "sell" ? "卖" : "中"
          // 大单高亮 (>=500手)
          const isLarge = tx.volume >= 500
          const isSuperLarge = tx.volume >= 2000

          return (
            <div
              key={`${tx.time}-${i}`}
              className={`flex items-center h-5 ${
                isSuperLarge
                  ? "bg-yellow-500/10 font-semibold"
                  : isLarge
                  ? "bg-orange-500/5"
                  : ""
              }`}
            >
              <span className="w-16 text-muted-foreground">{tx.time}</span>
              <span className={`flex-1 text-right ${colorClass}`}>
                {formatPrice(tx.price)}
              </span>
              <span
                className={`w-16 text-right ${
                  isSuperLarge ? "text-yellow-400" : isLarge ? "text-orange-400" : "text-foreground"
                }`}
              >
                {tx.volume}
              </span>
              <span className={`w-10 text-right ${colorClass}`}>{dirLabel}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground border-t border-border pt-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-yellow-500/30 inline-block" /> &ge;2000手
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-orange-500/20 inline-block" /> &ge;500手
        </span>
      </div>
    </div>
  )
}

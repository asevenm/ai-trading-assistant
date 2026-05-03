"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, Spin, Typography, Tag, App } from "antd"
import { StrategySelector } from "@/components/stock-screen/StrategySelector"
import { ScreenResultTable } from "@/components/stock-screen/ScreenResultTable"
import type { ScreenStrategy, ScreenMatch } from "@/lib/ai/stock-screener"
import { isHKCode } from "@/lib/stock-api"

const { Text } = Typography

export default function StockScreenPage() {
  const router = useRouter()
  const [strategies, setStrategies] = useState<ScreenStrategy[]>([])
  const [activeStrategy, setActiveStrategy] = useState("")
  const [results, setResults] = useState<ScreenMatch[]>([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const { message } = App.useApp()
  const ranRef = useRef<Set<string>>(new Set())

  const fetchStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/stock-screen/strategies")
      const data = await res.json()
      setStrategies(data)
      if (data.length > 0) {
        setActiveStrategy(data[0].id)
      }
    } catch {
      console.error("Failed to fetch strategies")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStrategies()
  }, [fetchStrategies])

  const runScreen = useCallback(async (strategy: string) => {
    if (!strategy) return
    setRunning(true)
    setResults([])
    try {
      const res = await fetch("/api/stock-screen/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy }),
      })

      if (!res.ok) {
        const data = await res.json()
        message.error(data.error || "筛选失败")
        return
      }

      const data = await res.json()
      setResults(data.results || [])
      if (data.count > 0) {
        message.success(`发现 ${data.count} 只匹配股票`)
      }
    } catch {
      // ignore
    } finally {
      setRunning(false)
    }
  }, [message])

  // Auto-run when strategy changes
  useEffect(() => {
    if (!activeStrategy) return
    // Avoid re-running the initial strategy on mount twice
    if (ranRef.current.has(activeStrategy)) return
    ranRef.current.add(activeStrategy)
    runScreen(activeStrategy)
  }, [activeStrategy, runScreen])

  const handleStrategyChange = (key: string) => {
    setActiveStrategy(key)
    // Clear cache so switching back re-runs
    ranRef.current.delete(key)
    // Will trigger via useEffect
  }

  const handleAddToWatchlist = async (code: string, name: string) => {
    try {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          market: isHKCode(code) ? "HK" : code.startsWith("6") ? "SH" : "SZ",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        message.warning(data.error || "添加失败")
        return
      }

      message.success(`${name} 已加入自选`)
    } catch {
      message.error("添加失败")
    }
  }

  const handleViewDetail = (code: string) => {
    router.push(`/stock/${code}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">趋势选股</h1>
      </div>

      <StrategySelector
        strategies={strategies}
        activeStrategy={activeStrategy}
        onChange={handleStrategyChange}
      />

      <Card variant="borderless" className="mt-4">
        {running ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spin size="large" />
            <Text type="secondary" className="mt-4">
              正在筛选股票，请稍候...（需获取K线数据并计算指标）
            </Text>
          </div>
        ) : (
          <ScreenResultTable
            results={results}
            loading={false}
            onAddToWatchlist={handleAddToWatchlist}
            onViewDetail={handleViewDetail}
          />
        )}
      </Card>

      {!running && results.length > 0 && (
        <div className="mt-4 text-center">
          <Text type="secondary">
            共筛选出 <Tag color="blue">{results.length}</Tag> 只符合
            「{strategies.find((s) => s.id === activeStrategy)?.name}」策略的股票
          </Text>
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { Button, Spin, DatePicker, Typography, Card, App } from "antd"
import { RobotOutlined } from "@ant-design/icons"
import { DailyReview } from "@prisma/client"
import dayjs from "dayjs"
import { IndexCards } from "@/components/daily-review/IndexCards"
import { SectorHeatmap } from "@/components/daily-review/SectorHeatmap"
import { MarketOverview } from "@/components/daily-review/MarketOverview"
import { NorthboundCard } from "@/components/daily-review/NorthboundCard"
import { AiSummary } from "@/components/daily-review/AiSummary"
import { RotationDailyReviewSection } from "@/components/rotation/RotationDailyReviewSection"
import type { MarketIndex, SectorData, MarketStats, NorthboundFlow } from "@/lib/market-api"

const { Text } = Typography

function parseJson<T>(str: string | null, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

export default function DailyReviewPage() {
  const { message } = App.useApp()
  const [reviews, setReviews] = useState<DailyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [outlook, setOutlook] = useState("")

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-review?limit=30")
      const data = await res.json()
      setReviews(data)
    } catch {
      console.error("Failed to fetch daily reviews")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch("/api/daily-review/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate.toISOString() }),
      })

      if (!res.ok) {
        const data = await res.json()
        message.error(data.error || "生成失败")
        return
      }

      const data = await res.json()
      setOutlook(data.outlook || "")
      message.success("每日复盘已生成")
      fetchReviews()
    } catch {
      message.error("生成失败")
    } finally {
      setGenerating(false)
    }
  }

  const currentReview = reviews.find((r) =>
    dayjs(r.date).isSame(selectedDate, "day")
  )

  const indices: MarketIndex[] = parseJson(currentReview?.indexSummary ?? null, [])
  const sectors: SectorData[] = parseJson(currentReview?.sectorSummary ?? null, [])
  const stats: MarketStats = parseJson(currentReview?.marketStats ?? null, {
    upCount: 0,
    downCount: 0,
    flatCount: 0,
    limitUpCount: 0,
    limitDownCount: 0,
    totalTurnover: 0,
  })
  const northbound: NorthboundFlow | null = parseJson(
    currentReview?.northbound ?? null,
    null
  )
  const hotTopics: string[] = parseJson(currentReview?.aiHotTopics ?? null, [])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">每日复盘</h1>
        <div className="flex items-center gap-4">
          <DatePicker
            value={selectedDate}
            onChange={(date) => date && setSelectedDate(date)}
            allowClear={false}
            disabledDate={(current) => current && current > dayjs().endOf("day")}
          />
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleGenerate}
            loading={generating}
            disabled={!!currentReview}
          >
            {currentReview ? "已生成" : "生成今日复盘"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : currentReview ? (
        <div className="space-y-4">
          <IndexCards indices={indices} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MarketOverview stats={stats} />
            <NorthboundCard data={northbound} />
          </div>

          <SectorHeatmap sectors={sectors} />

          <AiSummary
            summary={currentReview.aiSummary}
            hotTopics={hotTopics}
            outlook={outlook}
          />

          {/* 轮动复盘（基于 BoardSnapshot 时序数据） */}
          <RotationDailyReviewSection boardType="CONCEPT" />
        </div>
      ) : (
        <Card variant="borderless">
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">
              {selectedDate.format("YYYY年MM月DD日")} 暂无复盘数据
            </p>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleGenerate}
              loading={generating}
            >
              生成复盘
            </Button>
          </div>
        </Card>
      )}

      {reviews.length > 0 && (
        <Card title="历史复盘" variant="borderless" className="mt-6">
          <div className="divide-y divide-border">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="flex justify-between w-full cursor-pointer hover:bg-secondary/30 px-4 py-3 rounded"
                onClick={() => setSelectedDate(dayjs(review.date))}
              >
                <Text strong>
                  {dayjs(review.date).format("YYYY-MM-DD")}
                </Text>
                <Text type="secondary" className="line-clamp-1 max-w-md">
                  {review.aiSummary?.slice(0, 60) || "暂无总结"}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

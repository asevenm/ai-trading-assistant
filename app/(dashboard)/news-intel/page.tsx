"use client"

import { useCallback, useEffect, useState } from "react"
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Spin,
  Statistic,
  Tabs,
  Tag,
} from "antd"
import {
  FileTextOutlined,
  NotificationOutlined,
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons"
import Link from "next/link"
import type { StockAnnouncement, MarketNews } from "@/lib/news-api"
import type { NewsAnalysis, NewsSentiment } from "@/lib/ai/news-analyzer"

type AnnouncementWithAnalysis = StockAnnouncement & { analysis: NewsAnalysis | null }
type NewsWithAnalysis = MarketNews & { analysis: NewsAnalysis | null }

const SENTIMENT_COLOR: Record<NewsSentiment, string> = {
  bullish: "red",
  bearish: "green",
  neutral: "default",
}

const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
  bullish: "利好",
  bearish: "利空",
  neutral: "中性",
}

export default function NewsIntelPage() {
  const { message } = App.useApp()
  const [announcements, setAnnouncements] = useState<AnnouncementWithAnalysis[]>([])
  const [news, setNews] = useState<NewsWithAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/news-intel", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setAnnouncements((json.announcements ?? []).map((a: StockAnnouncement) => ({ ...a, analysis: null })))
      setNews((json.news ?? []).map((n: MarketNews) => ({ ...n, analysis: null })))
      setLastUpdate(new Date().toLocaleTimeString())
    } catch {
      message.error("加载消息失败")
    } finally {
      setLoading(false)
    }
  }, [message])

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true)
    try {
      const res = await fetch("/api/news-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setAnnouncements(json.announcements ?? [])
      setNews(json.news ?? [])
      setLastUpdate(new Date().toLocaleTimeString())
      message.success("AI 分析完成")
    } catch {
      message.error("AI 分析失败")
    } finally {
      setAnalyzing(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const analyzedAll: AnalyzedItem[] = [
    ...announcements,
    ...news,
  ].filter(
    (item): item is AnalyzedItem => item.analysis !== null
  )
  const strongBullish = analyzedAll.filter(
    (item) => item.analysis.sentiment === "bullish" && item.analysis.strength >= 7
  )
  const strongBearish = analyzedAll.filter(
    (item) => item.analysis.sentiment === "bearish" && item.analysis.strength >= 7
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <NotificationOutlined className="text-2xl text-primary" />
          <h1 className="text-2xl font-bold m-0">消息雷达</h1>
          {lastUpdate && (
            <span className="text-sm text-muted ml-2">最后更新 {lastUpdate}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={runAnalysis}
            loading={analyzing}
          >
            AI 解读
          </Button>
        </div>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card variant="borderless">
            <Statistic title="自选股公告" value={announcements.length} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic title="财经快讯" value={news.length} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="强利好(≥7)"
              value={strongBullish.length}
              suffix="条"
              prefix={<ThunderboltOutlined />}
              styles={{ content: { color: "var(--trading-up)" } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title="强利空(≥7)"
              value={strongBearish.length}
              suffix="条"
              styles={{ content: { color: "var(--trading-down)" } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 强信号聚合 */}
      {(strongBullish.length > 0 || strongBearish.length > 0) && (
        <Card variant="borderless" className="mb-6" title="⚡ 强信号聚焦">
          <Row gutter={16}>
            {strongBullish.length > 0 && (
              <Col span={12}>
                <div className="text-sm text-muted mb-2">强利好</div>
                <div className="space-y-2">
                  {strongBullish.slice(0, 5).map((item, i) => (
                    <StrongSignalItem key={i} item={item} />
                  ))}
                </div>
              </Col>
            )}
            {strongBearish.length > 0 && (
              <Col span={12}>
                <div className="text-sm text-muted mb-2">强利空</div>
                <div className="space-y-2">
                  {strongBearish.slice(0, 5).map((item, i) => (
                    <StrongSignalItem key={i} item={item} />
                  ))}
                </div>
              </Col>
            )}
          </Row>
        </Card>
      )}

      <Tabs
        items={[
          {
            key: "announcements",
            label: (
              <Badge count={announcements.length} overflowCount={99} size="small">
                <span className="px-2">
                  <FileTextOutlined /> 自选股公告
                </span>
              </Badge>
            ),
            children: (
              <Card variant="borderless">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Spin size="large" />
                  </div>
                ) : announcements.length === 0 ? (
                  <Empty description="暂无公告（请先添加自选股）" />
                ) : (
                  <div className="space-y-3">
                    {announcements.map((a) => (
                      <AnnouncementItem key={a.id} announcement={a} />
                    ))}
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: "news",
            label: (
              <Badge count={news.length} overflowCount={99} size="small">
                <span className="px-2">
                  <NotificationOutlined /> 财经快讯
                </span>
              </Badge>
            ),
            children: (
              <Card variant="borderless">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Spin size="large" />
                  </div>
                ) : news.length === 0 ? (
                  <Empty description="暂无快讯" />
                ) : (
                  <div className="space-y-3">
                    {news.map((n) => (
                      <NewsItem key={n.id} news={n} />
                    ))}
                  </div>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}

function StrongSignalItem({ item }: { item: AnalyzedItem }) {
  const isAnnouncement = "code" in item && !!item.code
  const title =
    isAnnouncement && "name" in item
      ? `${(item as AnnouncementWithAnalysis).name}: ${item.title}`
      : item.title
  return (
    <div className="border border-border rounded p-2">
      <div className="flex items-start gap-2">
        <Tag color={SENTIMENT_COLOR[item.analysis.sentiment]} variant="filled">
          {item.analysis.strength}
        </Tag>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate" title={title}>
            {title}
          </div>
          <div className="text-xs text-muted">💡 {item.analysis.tradeHint}</div>
        </div>
      </div>
    </div>
  )
}

type AnalyzedItem =
  | (AnnouncementWithAnalysis & { analysis: NewsAnalysis })
  | (NewsWithAnalysis & { analysis: NewsAnalysis })

function AnnouncementItem({ announcement }: { announcement: AnnouncementWithAnalysis }) {
  return (
    <div className="border border-border rounded p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link href={`/stock/${announcement.code}`} className="text-primary hover:underline">
              <span className="font-medium">{announcement.name}</span>
              <span className="font-mono text-xs ml-1">({announcement.code})</span>
            </Link>
            <Tag variant="filled">{announcement.type}</Tag>
            <span className="text-xs text-muted">{announcement.publishedAt}</span>
          </div>
          <a
            href={announcement.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
          >
            {announcement.title}
          </a>
        </div>
        {announcement.analysis && <AnalysisBox analysis={announcement.analysis} />}
      </div>
    </div>
  )
}

function NewsItem({ news }: { news: NewsWithAnalysis }) {
  return (
    <div className="border border-border rounded p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted">{news.publishedAt}</span>
            <span className="text-xs text-muted">{news.source}</span>
          </div>
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline font-medium"
          >
            {news.title}
          </a>
          {news.summary && (
            <div className="text-xs text-muted mt-1 line-clamp-2">{news.summary}</div>
          )}
          {news.relatedCodes.length > 0 && (
            <div className="flex gap-1 mt-1">
              {news.relatedCodes.slice(0, 5).map((c) => (
                <Link key={c} href={`/stock/${c}`}>
                  <Tag variant="filled" color="blue" className="cursor-pointer">
                    {c}
                  </Tag>
                </Link>
              ))}
            </div>
          )}
        </div>
        {news.analysis && <AnalysisBox analysis={news.analysis} />}
      </div>
    </div>
  )
}

function AnalysisBox({ analysis }: { analysis: NewsAnalysis }) {
  return (
    <div className="w-60 shrink-0">
      <div className="flex items-center gap-2 mb-1">
        <Tag color={SENTIMENT_COLOR[analysis.sentiment]} variant="filled">
          {SENTIMENT_LABEL[analysis.sentiment]}
        </Tag>
        <Progress
          percent={analysis.strength * 10}
          size="small"
          showInfo={false}
          strokeColor={
            analysis.sentiment === "bullish"
              ? "var(--trading-up)"
              : analysis.sentiment === "bearish"
                ? "var(--trading-down)"
                : "var(--text-muted)"
          }
          className="flex-1"
        />
        <span className="text-xs font-medium">{analysis.strength}</span>
      </div>
      {analysis.impact && (
        <div className="text-xs text-muted mb-1">📊 {analysis.impact}</div>
      )}
      {analysis.tradeHint && (
        <div className="text-xs text-primary mb-1">💡 {analysis.tradeHint}</div>
      )}
      {analysis.relatedConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.relatedConcepts.map((c, i) => (
            <Tag key={i} variant="filled" color="gold" className="!text-xs">
              {c}
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}

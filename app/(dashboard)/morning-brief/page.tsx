"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, Button, Spin, Tag, Row, Col, Statistic, App, Empty } from "antd"
import {
  RobotOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  AimOutlined,
  BulbOutlined,
} from "@ant-design/icons"
import dayjs from "dayjs"
import type { SectorFlow } from "@/lib/sector-flow-api"
import { RotationMorningPlanSection } from "@/components/rotation/RotationMorningPlanSection"

interface FocusStock {
  code: string
  name: string
  reason: string
}

interface BriefData {
  date: string
  marketSentiment: string
  mainThemes: string[]
  focusStocks: FocusStock[]
  strategy: string
  risks: string[]
  limitUp: {
    total: number
    bustedCount: number
    bustedRate: number
  }
  sectorInflow: SectorFlow[]
}

interface HistoryBrief {
  id: string
  date: string
  aiStrategy: {
    marketSentiment: string
    mainThemes: string[]
    strategy: string
  } | null
}

export default function MorningBriefPage() {
  const { message } = App.useApp()
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [history, setHistory] = useState<HistoryBrief[]>([])
  const [loading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/morning-brief")
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch("/api/morning-brief/generate", { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        message.error(data.error || "生成失败")
        return
      }
      const data = await res.json()
      setBrief(data)
      message.success("作战计划已生成")
      fetchHistory()
    } catch {
      message.error("生成失败")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">盘前作战计划</h1>
        <Button
          type="primary"
          icon={<RobotOutlined />}
          onClick={handleGenerate}
          loading={generating}
          size="large"
        >
          {generating ? "生成中..." : "生成今日计划"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : brief ? (
        <div className="space-y-6">
          {/* 市场情绪 */}
          <Card variant="borderless">
            <div className="flex items-start gap-3">
              <BulbOutlined className="text-2xl text-yellow-500 mt-1" />
              <div>
                <div className="text-sm text-muted-foreground mb-1">市场情绪判断</div>
                <div className="text-lg font-medium">{brief.marketSentiment}</div>
              </div>
            </div>
          </Card>

          {/* 涨停统计 */}
          <Row gutter={16}>
            <Col span={8}>
              <Card variant="borderless">
                <Statistic
                  title="昨日涨停"
                  value={brief.limitUp.total}
                  suffix="只"
                  prefix={<RiseOutlined />}
                  styles={{ content: { color: "var(--trading-up)" } }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card variant="borderless">
                <Statistic
                  title="炸板数"
                  value={brief.limitUp.bustedCount}
                  suffix="只"
                  prefix={<ThunderboltOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card variant="borderless">
                <Statistic
                  title="炸板率"
                  value={brief.limitUp.bustedRate}
                  precision={1}
                  suffix="%"
                  styles={{
                    content: {
                      color: brief.limitUp.bustedRate > 30
                        ? "var(--trading-down)"
                        : "var(--trading-up)",
                    },
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* 当日主线 */}
          <Card title="当日交易主线" variant="borderless">
            <div className="space-y-3">
              {brief.mainThemes.map((theme, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Tag color="blue" variant="filled" className="text-base px-3 py-1">
                    主线 {i + 1}
                  </Tag>
                  <span className="text-base">{theme}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 资金流向 Top 板块 */}
          {brief.sectorInflow.length > 0 && (
            <Card title="资金流入板块" variant="borderless">
              <div className="space-y-2">
                {brief.sectorInflow.slice(0, 8).map((s, i) => (
                  <div key={s.code} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-up w-5">{i + 1}</span>
                      <span className="font-medium">{s.name}</span>
                      <span className={s.changePercent >= 0 ? "text-up" : "text-down"}>
                        {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <span className="text-up font-medium">
                      +{(s.mainNetInflow / 1e8).toFixed(1)}亿
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 重点关注个股 */}
          <Card
            title={<><AimOutlined className="mr-2" />重点关注个股</>}
            variant="borderless"
          >
            <div className="space-y-3">
              {brief.focusStocks.map((stock) => (
                <div
                  key={stock.code}
                  className="flex items-start gap-3 p-3 rounded bg-secondary/30"
                >
                  <Tag color="red" variant="filled">{stock.code}</Tag>
                  <div>
                    <span className="font-medium">{stock.name}</span>
                    <div className="text-sm text-muted-foreground mt-1">
                      {stock.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 操作策略 */}
          <Card title="操作策略" variant="borderless">
            <div className="text-base leading-relaxed">{brief.strategy}</div>
          </Card>

          {/* 风险提示 */}
          {brief.risks.length > 0 && (
            <Card
              title={<><WarningOutlined className="mr-2 text-yellow-500" />风险提示</>}
              variant="borderless"
            >
              <div className="space-y-2">
                {brief.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-yellow-500">!</span>
                    <span>{risk}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 轮动预判（基于昨日 BoardSnapshot） */}
          <RotationMorningPlanSection boardType="CONCEPT" />
        </div>
      ) : (
        <Card variant="borderless">
          <Empty
            description="点击上方按钮生成今日作战计划"
            className="py-16"
          >
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleGenerate}
              loading={generating}
            >
              生成今日计划
            </Button>
          </Empty>
        </Card>
      )}

      {/* 历史记录 */}
      {history.length > 0 && !brief && (
        <Card title="历史作战计划" variant="borderless" className="mt-6">
          <div className="divide-y divide-border">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex justify-between items-center py-3 cursor-pointer hover:bg-secondary/30 px-4 rounded"
                onClick={() => {
                  if (h.aiStrategy) {
                    setBrief({
                      date: h.date,
                      ...h.aiStrategy,
                      focusStocks: [],
                      risks: [],
                      limitUp: { total: 0, bustedCount: 0, bustedRate: 0 },
                      sectorInflow: [],
                    })
                  }
                }}
              >
                <span className="font-medium">
                  {dayjs(h.date).format("YYYY-MM-DD")}
                </span>
                <span className="text-muted-foreground text-sm line-clamp-1 max-w-md">
                  {h.aiStrategy?.marketSentiment || "暂无数据"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

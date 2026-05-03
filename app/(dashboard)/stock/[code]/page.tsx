"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, Button, Spin, Popconfirm, Card, App, Typography, Space, Statistic, Row, Col } from "antd";
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, RiseOutlined, FallOutlined, MinusOutlined } from "@ant-design/icons";
import { Stock, StockGroup, Event, ResearchNote, ValidationIndicator, TradePlan, DeepResearch } from "@prisma/client";
import type { StockQuote } from "@/lib/stock-api";
import { StockHeader } from "@/components/stock-detail/StockHeader";
import { KlineChart } from "@/components/stock-detail/KlineChart";
import { EventTimeline } from "@/components/stock-detail/EventTimeline";
import { ResearchNotes } from "@/components/stock-detail/ResearchNotes";
import { ValidationPanel } from "@/components/stock-detail/ValidationPanel";
import { ResearchReport } from "@/components/deep-research/ResearchReport";
import { Level2Panel } from "@/components/level2/Level2Panel";
import { isHKCode } from "@/lib/stock-api";
import { formatPrice, formatPercent, formatAmount } from "@/lib/utils";

const { Title, Text } = Typography;

type StockDetail = Stock & {
  group?: StockGroup | null;
  events: Event[];
  researchNotes: ResearchNote[];
  validationIndicators: ValidationIndicator[];
  tradePlans: TradePlan[];
  deepResearches?: DeepResearch[];
};

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { message } = App.useApp();

  const [stock, setStock] = useState<StockDetail | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingResearch, setGeneratingResearch] = useState(false);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);

  const fetchStock = useCallback(async () => {
    try {
      const res = await fetch(`/api/stocks/${code}`);
      if (!res.ok) {
        if (res.status === 404) {
          setIsWatchlisted(false);
          setLoading(false);
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setStock(data);
      setIsWatchlisted(true);
    } catch {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [code, message]);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock-data?action=quotes&codes=${code}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data[code]) setQuote(data[code]);
    } catch {
      // silently ignore quote fetch errors
    }
  }, [code]);

  useEffect(() => {
    fetchStock();
    fetchQuote();
    const interval = setInterval(fetchQuote, 10000);
    return () => clearInterval(interval);
  }, [fetchStock, fetchQuote]);

  const handleDelete = async () => {
    try {
      await fetch(`/api/stocks/${code}`, { method: "DELETE" });
      message.success("已从自选中删除");
      router.push("/");
    } catch {
      message.error("删除失败");
    }
  };

  const getMarket = () => isHKCode(code) ? "HK" : code.startsWith("6") ? "SH" : "SZ";

  const handleAddToWatchlist = async () => {
    if (!quote) return;
    setAddingToWatchlist(true);
    try {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: quote.code,
          name: quote.name,
          market: getMarket(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        message.error(data.error || "添加失败");
        return;
      }
      message.success("已加入自选");
      setIsWatchlisted(true);
      fetchStock();
    } catch {
      message.error("添加失败");
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const handleGenerateResearch = async () => {
    if (!stock) return;
    setGeneratingResearch(true);
    try {
      const res = await fetch("/api/deep-research/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: stock.code,
          name: stock.name,
          stockId: stock.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        message.error(data.error || "生成失败");
        return;
      }
      message.success("深度研报已生成");
      fetchStock();
    } catch {
      message.error("生成失败");
    } finally {
      setGeneratingResearch(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (!stock && !isWatchlisted) {
    const changePercent = quote?.changePercent ?? 0;
    const isUp = changePercent > 0;
    const isDown = changePercent < 0;
    const getChangeClass = () => {
      if (isUp) return "text-up";
      if (isDown) return "text-down";
      return "text-neutral";
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
          >
            返回
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddToWatchlist}
            loading={addingToWatchlist}
            disabled={!quote}
          >
            加入自选
          </Button>
        </div>

        {quote ? (
          <div className="bg-card p-6 rounded-lg border border-border mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <Space align="center">
                  <Title level={3} className="!mb-0 !text-foreground">
                    {quote.name}
                  </Title>
                  <Text type="secondary">
                    {quote.code} · {getMarket()}
                  </Text>
                </Space>
              </div>
              <div className="text-right">
                <Title level={2} className={`!mb-0 ${getChangeClass()}`}>
                  {formatPrice(quote.price)}
                </Title>
                <Space className={getChangeClass()}>
                  {isUp ? <RiseOutlined /> : isDown ? <FallOutlined /> : <MinusOutlined />}
                  <Text className={getChangeClass()}>
                    {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}
                  </Text>
                  <Text className={getChangeClass()}>
                    {formatPercent(changePercent)}
                  </Text>
                </Space>
              </div>
            </div>
            <Row gutter={24}>
              <Col span={4}>
                <Statistic title="今开" value={quote.open} precision={2} styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={4}>
                <Statistic title="最高" value={quote.high} precision={2} styles={{ content: { fontSize: 14, color: "var(--trading-up)" } }} />
              </Col>
              <Col span={4}>
                <Statistic title="最低" value={quote.low} precision={2} styles={{ content: { fontSize: 14, color: "var(--trading-down)" } }} />
              </Col>
              <Col span={4}>
                <Statistic title="昨收" value={quote.prevClose} precision={2} styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={4}>
                <Statistic title="成交量" value={formatAmount(quote.volume)} styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={4}>
                <Statistic title="成交额" value={formatAmount(quote.turnover)} styles={{ content: { fontSize: 14 } }} />
              </Col>
            </Row>
          </div>
        ) : (
          <div className="flex justify-center items-center h-32">
            <Spin />
          </div>
        )}

        <KlineChart code={code} />

        <Card variant="borderless">
          <div className="text-center py-8 text-muted-foreground">
            <p>该股票不在自选列表中</p>
            <p className="text-sm mt-1">加入自选后可查看事件时间线、研究笔记、交易计划等</p>
            <Button
              type="primary"
              className="mt-4"
              icon={<PlusOutlined />}
              onClick={handleAddToWatchlist}
              loading={addingToWatchlist}
              disabled={!quote}
            >
              加入自选
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!stock) {
    return null;
  }

  const tabItems = [
    {
      key: "level2",
      label: "Level-2",
      children: (
        <Level2Panel code={code} />
      ),
    },
    {
      key: "events",
      label: "事件时间线",
      children: (
        <Card variant="borderless">
          <EventTimeline events={stock.events} onAddEvent={() => { }} />
        </Card>
      ),
    },
    {
      key: "research",
      label: "研究笔记",
      children: (
        <Card variant="borderless">
          <ResearchNotes
            stockId={stock.id}
            notes={stock.researchNotes}
            onRefresh={fetchStock}
          />
        </Card>
      ),
    },
    {
      key: "validation",
      label: "验证指标",
      children: (
        <Card variant="borderless">
          <ValidationPanel
            stockId={stock.id}
            indicators={stock.validationIndicators}
            onRefresh={fetchStock}
          />
        </Card>
      ),
    },
    {
      key: "trade",
      label: "交易计划",
      children: (
        <Card variant="borderless">
          {stock.tradePlans.length > 0 ? (
            <div>
              {stock.tradePlans.map((plan) => (
                <div key={plan.id} className="p-4 bg-secondary/30 rounded mb-2">
                  <div className="font-medium mb-2">入场条件</div>
                  <div className="text-sm text-muted-foreground mb-3">
                    {plan.entryConditions}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">止损:</span>{" "}
                      <span className="text-down">{plan.stopLoss}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">止盈:</span>{" "}
                      <span className="text-up">{plan.takeProfit || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">仓位:</span>{" "}
                      {(plan.maxPosition * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>暂无交易计划</p>
              <Button
                type="primary"
                className="mt-2"
                onClick={() => router.push(`/trade-plan?stock=${code}`)}
              >
                创建交易计划
              </Button>
            </div>
          )}
        </Card>
      ),
    },
    {
      key: "deep-research",
      label: "深度研报",
      children: (
        <Card variant="borderless">
          {stock.deepResearches && stock.deepResearches.length > 0 ? (
            <div className="space-y-6">
              <ResearchReport research={stock.deepResearches[0]} />
              <div className="text-center">
                <Button
                  type="primary"
                  onClick={handleGenerateResearch}
                  loading={generatingResearch}
                >
                  重新生成研报
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>暂无深度研报</p>
              <Button
                type="primary"
                className="mt-2"
                onClick={handleGenerateResearch}
                loading={generatingResearch}
              >
                AI 生成深度研报
              </Button>
            </div>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
        >
          返回
        </Button>
        <Popconfirm
          title="确定从自选中删除？"
          onConfirm={handleDelete}
          okText="删除"
          okType="danger"
        >
          <Button danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </div>

      <StockHeader stock={stock} quote={quote} />

      <KlineChart code={code} />

      <Tabs items={tabItems} defaultActiveKey="level2" />
    </div>
  );
}

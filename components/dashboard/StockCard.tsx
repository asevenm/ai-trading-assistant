"use client";

import { Card, Tag, Typography, Space } from "antd";
import { RiseOutlined, FallOutlined, MinusOutlined } from "@ant-design/icons";
import { Stock, StockGroup, Event } from "@prisma/client";
import { StockQuote } from "@/lib/stock-api";
import { formatPrice, formatPercent, formatAmount } from "@/lib/utils";

const { Text } = Typography;

interface StockCardProps {
  stock: Stock & {
    group?: StockGroup | null;
    events?: Event[];
  };
  quote?: StockQuote | null;
  onClick: () => void;
}

export function StockCard({ stock, quote, onClick }: StockCardProps) {
  const tags: string[] = stock.tags ? JSON.parse(stock.tags) : [];
  const todayEvents = stock.events || [];

  const changePercent = quote?.changePercent ?? 0;
  const isUp = changePercent > 0;
  const isDown = changePercent < 0;

  const getChangeIcon = () => {
    if (isUp) return <RiseOutlined />;
    if (isDown) return <FallOutlined />;
    return <MinusOutlined />;
  };

  const getChangeClass = () => {
    if (isUp) return "text-up";
    if (isDown) return "text-down";
    return "text-neutral";
  };

  return (
    <Card
      variant="borderless"
      hoverable
      className="cursor-pointer transition-all hover:border-primary"
      onClick={onClick}
      styles={{ body: { padding: 16 } }}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <Text strong className="text-base !text-foreground block">
            {stock.name}
          </Text>
          <Text type="secondary" className="text-xs">
            {stock.code} · {stock.market}
          </Text>
        </div>
        <div className="text-right">
          <Text strong className={`text-lg block ${getChangeClass()}`}>
            {quote ? formatPrice(quote.price) : "--"}
          </Text>
          <Space size={4} className={getChangeClass()}>
            {getChangeIcon()}
            <Text className={getChangeClass()}>
              {quote ? formatPercent(changePercent) : "--"}
            </Text>
          </Space>
        </div>
      </div>

      {quote && (
        <div className="flex justify-between text-xs text-muted-foreground mb-3">
          <span>成交额: {formatAmount(quote.turnover)}</span>
          <span>
            振幅:{" "}
            {quote.prevClose
              ? (((quote.high - quote.low) / quote.prevClose) * 100).toFixed(2)
              : 0}
            %
          </span>
        </div>
      )}

      {todayEvents.length > 0 && (
        <div className="mb-3 p-2 rounded bg-secondary/50">
          <Text className="text-xs !text-muted-foreground">今日事件:</Text>
          <Text className="text-sm !text-foreground block truncate">
            {todayEvents[0].summary}
          </Text>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Tag key={tag} className="!text-xs !m-0">
              {tag}
            </Tag>
          ))}
          {tags.length > 3 && (
            <Tag className="!text-xs !m-0">+{tags.length - 3}</Tag>
          )}
        </div>
      )}

      {stock.group && (
        <div className="mt-2 pt-2 border-t border-border">
          <Tag
            color={stock.group.color || "default"}
            className="!text-xs !m-0"
          >
            {stock.group.name}
          </Tag>
        </div>
      )}
    </Card>
  );
}

"use client";

import { Typography, Space, Tag, Statistic, Row, Col } from "antd";
import { RiseOutlined, FallOutlined, MinusOutlined } from "@ant-design/icons";
import { Stock, StockGroup } from "@prisma/client";
import { StockQuote } from "@/lib/stock-api";
import { formatPrice, formatPercent, formatAmount } from "@/lib/utils";

const { Title, Text } = Typography;

interface StockHeaderProps {
  stock: Stock & { group?: StockGroup | null };
  quote?: StockQuote | null;
}

export function StockHeader({ stock, quote }: StockHeaderProps) {
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
    <div className="bg-card p-6 rounded-lg border border-border mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Space align="center">
            <Title level={3} className="!mb-0 !text-foreground">
              {stock.name}
            </Title>
            <Text type="secondary">
              {stock.code} · {stock.market}
            </Text>
            {stock.group && (
              <Tag color={stock.group.color || "default"}>
                {stock.group.name}
              </Tag>
            )}
          </Space>
        </div>
        <div className="text-right">
          <Title level={2} className={`!mb-0 ${getChangeClass()}`}>
            {quote ? formatPrice(quote.price) : "--"}
          </Title>
          <Space className={getChangeClass()}>
            {getChangeIcon()}
            <Text className={getChangeClass()}>
              {quote ? `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}` : "--"}
            </Text>
            <Text className={getChangeClass()}>
              {quote ? formatPercent(changePercent) : "--"}
            </Text>
          </Space>
        </div>
      </div>

      {quote && (
        <Row gutter={24}>
          <Col span={4}>
            <Statistic
              title="今开"
              value={quote.open}
              precision={2}
              styles={{ content: { fontSize: 14 } }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="最高"
              value={quote.high}
              precision={2}
              styles={{ content: { fontSize: 14, color: "var(--trading-up)" } }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="最低"
              value={quote.low}
              precision={2}
              styles={{ content: { fontSize: 14, color: "var(--trading-down)" } }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="昨收"
              value={quote.prevClose}
              precision={2}
              styles={{ content: { fontSize: 14 } }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="成交量"
              value={formatAmount(quote.volume)}
              styles={{ content: { fontSize: 14 } }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="成交额"
              value={formatAmount(quote.turnover)}
              styles={{ content: { fontSize: 14 } }}
            />
          </Col>
        </Row>
      )}
    </div>
  );
}

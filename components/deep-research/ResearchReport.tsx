"use client"

import { Card, Tag, Typography, Divider } from "antd"
import {
  RobotOutlined,
  FundOutlined,
  WarningOutlined,
  RiseOutlined,
  AimOutlined,
} from "@ant-design/icons"
import { DeepResearch } from "@prisma/client"
import dayjs from "dayjs"

const { Paragraph, Title } = Typography

interface ResearchReportProps {
  research: DeepResearch
}

const ratingColorMap: Record<string, string> = {
  强烈看好: "red",
  看好: "orange",
  中性: "blue",
  看空: "green",
  强烈看空: "green",
}

export function ResearchReport({ research }: ResearchReportProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Title level={4} className="!mb-1">
            {research.stockName}({research.stockCode})
          </Title>
          <span className="text-muted-foreground text-sm">
            生成时间: {dayjs(research.createdAt).format("YYYY-MM-DD HH:mm")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {research.rating && (
            <Tag
              color={ratingColorMap[research.rating] || "default"}
              className="text-base px-3 py-1"
            >
              {research.rating}
            </Tag>
          )}
          {research.targetPrice && (
            <Tag variant="filled" className="text-base px-3 py-1">
              目标价: {research.targetPrice.toFixed(2)}
            </Tag>
          )}
        </div>
      </div>

      {research.conclusion && (
        <Card size="small" className="!bg-primary/5">
          <div className="flex items-start gap-2">
            <RobotOutlined className="text-primary mt-1" />
            <Paragraph className="!mb-0 font-medium">
              {research.conclusion}
            </Paragraph>
          </div>
        </Card>
      )}

      <Divider />

      {research.fundamentals && (
        <Card
          title={
            <span>
              <FundOutlined className="mr-2" />
              基本面分析
            </span>
          }
          size="small"
          variant="borderless"
        >
          <Paragraph className="!text-foreground whitespace-pre-wrap">
            {research.fundamentals}
          </Paragraph>
        </Card>
      )}

      {research.technicals && (
        <Card
          title={
            <span>
              <RiseOutlined className="mr-2" />
              技术面分析
            </span>
          }
          size="small"
          variant="borderless"
        >
          <Paragraph className="!text-foreground whitespace-pre-wrap">
            {research.technicals}
          </Paragraph>
        </Card>
      )}

      {research.catalysts && (
        <Card
          title={
            <span>
              <AimOutlined className="mr-2" />
              催化剂
            </span>
          }
          size="small"
          variant="borderless"
        >
          <Paragraph className="!text-foreground whitespace-pre-wrap">
            {research.catalysts}
          </Paragraph>
        </Card>
      )}

      {research.risks && (
        <Card
          title={
            <span>
              <WarningOutlined className="mr-2" />
              风险提示
            </span>
          }
          size="small"
          variant="borderless"
        >
          <Paragraph className="!text-foreground whitespace-pre-wrap">
            {research.risks}
          </Paragraph>
        </Card>
      )}

      {research.valuation && (
        <Card title="估值分析" size="small" variant="borderless">
          <Paragraph className="!text-foreground whitespace-pre-wrap">
            {research.valuation}
          </Paragraph>
        </Card>
      )}
    </div>
  )
}

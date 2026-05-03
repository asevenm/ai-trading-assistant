"use client"

import { Card, Tag, Typography } from "antd"
import { RobotOutlined } from "@ant-design/icons"

const { Paragraph } = Typography

interface AiSummaryProps {
  summary: string | null
  hotTopics: string[]
  outlook?: string
}

export function AiSummary({ summary, hotTopics, outlook }: AiSummaryProps) {
  if (!summary) return null

  return (
    <Card
      title={
        <span>
          <RobotOutlined className="mr-2" />
          AI 每日总结
        </span>
      }
      size="small"
      variant="borderless"
    >
      <Paragraph className="!text-foreground !mb-4">{summary}</Paragraph>

      {hotTopics.length > 0 && (
        <div className="mb-4">
          <span className="font-medium mr-2">今日热点:</span>
          {hotTopics.map((topic, i) => (
            <Tag key={i} color="blue" variant="filled" className="mb-1">
              {topic}
            </Tag>
          ))}
        </div>
      )}

      {outlook && (
        <div>
          <span className="font-medium mr-2">明日展望:</span>
          <span className="text-muted-foreground">{outlook}</span>
        </div>
      )}
    </Card>
  )
}

"use client"

import { Tag, Typography, Empty, Button } from "antd"
import { FileSearchOutlined, DeleteOutlined } from "@ant-design/icons"
import { DeepResearch } from "@prisma/client"
import dayjs from "dayjs"

const { Text } = Typography

const ratingColorMap: Record<string, string> = {
  强烈看好: "red",
  看好: "orange",
  中性: "blue",
  看空: "green",
  强烈看空: "green",
}

interface ResearchListProps {
  researches: DeepResearch[]
  onSelect: (research: DeepResearch) => void
  onDelete: (id: string) => void
}

export function ResearchList({
  researches,
  onSelect,
  onDelete,
}: ResearchListProps) {
  if (researches.length === 0) {
    return (
      <Empty
        image={<FileSearchOutlined className="text-4xl text-muted-foreground" />}
        description="暂无研报"
        className="py-16"
      />
    )
  }

  return (
    <div className="divide-y divide-border">
      {researches.map((research) => (
        <div
          key={research.id}
          className="flex items-center justify-between cursor-pointer hover:bg-secondary/30 px-4 py-3 rounded"
          onClick={() => onSelect(research)}
        >
          <div className="flex items-center gap-4 flex-1">
            <div>
              <Text strong>
                {research.stockName}({research.stockCode})
              </Text>
              <Text type="secondary" className="ml-4 text-sm">
                {dayjs(research.createdAt).format("YYYY-MM-DD HH:mm")}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              {research.rating && (
                <Tag
                  color={ratingColorMap[research.rating] || "default"}
                  variant="filled"
                >
                  {research.rating}
                </Tag>
              )}
              {research.targetPrice && (
                <Tag variant="filled">目标价: {research.targetPrice.toFixed(2)}</Tag>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Text type="secondary" className="line-clamp-1 max-w-sm text-sm">
              {research.conclusion?.slice(0, 50) || ""}
            </Text>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onDelete(research.id)
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

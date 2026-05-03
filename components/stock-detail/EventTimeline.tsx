"use client";

import { Timeline, Tag, Typography, Empty, Button } from "antd";
import { LinkOutlined, PlusOutlined } from "@ant-design/icons";
import { Event } from "@prisma/client";
import dayjs from "dayjs";

const { Text, Paragraph } = Typography;

interface EventTimelineProps {
  events: Event[];
  onAddEvent?: () => void;
}

const eventTypeMap: Record<string, { label: string; class: string }> = {
  earnings: { label: "财报", class: "event-earnings" },
  order: { label: "订单", class: "event-order" },
  policy: { label: "政策", class: "event-policy" },
  announcement: { label: "公告", class: "event-announcement" },
  other: { label: "其他", class: "event-other" },
};

const impactDirectionMap: Record<string, { label: string; color: string }> = {
  positive: { label: "正面", color: "green" },
  negative: { label: "负面", color: "red" },
  neutral: { label: "中性", color: "default" },
};

const impactDurationMap: Record<string, string> = {
  short: "短期",
  medium: "中期",
  long: "长期",
};

export function EventTimeline({ events, onAddEvent }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <Empty description="暂无事件记录" className="py-8">
        {onAddEvent && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddEvent}>
            添加事件
          </Button>
        )}
      </Empty>
    );
  }

  const timelineItems = events.map((event) => {
    const typeInfo = eventTypeMap[event.type] || eventTypeMap.other;
    const impactInfo = impactDirectionMap[event.impactDirection] || impactDirectionMap.neutral;

    return {
      key: event.id,
      color: impactInfo.color === "green" ? "green" : impactInfo.color === "red" ? "red" : "gray",
      children: (
        <div className="bg-card p-4 rounded-lg border border-border -mt-1">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${typeInfo.class}`}>
                {typeInfo.label}
              </span>
              <Tag color={impactInfo.color}>{impactInfo.label}</Tag>
              {event.impactDuration && (
                <Text type="secondary" className="text-xs">
                  {impactDurationMap[event.impactDuration] || event.impactDuration}
                </Text>
              )}
            </div>
            <Text type="secondary" className="text-xs">
              {dayjs(event.eventDate).format("YYYY-MM-DD")}
            </Text>
          </div>
          <Text strong className="block mb-1">
            {event.title}
          </Text>
          <Paragraph
            type="secondary"
            className="!mb-2 text-sm"
            ellipsis={{ rows: 2, expandable: true }}
          >
            {event.summary}
          </Paragraph>
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs hover:underline"
            >
              <LinkOutlined className="mr-1" />
              {event.sourceTitle || "查看原文"}
            </a>
          )}
          {event.aiGenerated && (
            <Tag className="ml-2 !text-xs" color="purple">
              AI生成
            </Tag>
          )}
        </div>
      ),
    };
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Text strong>事件时间线</Text>
        {onAddEvent && (
          <Button type="link" icon={<PlusOutlined />} onClick={onAddEvent}>
            添加事件
          </Button>
        )}
      </div>
      <Timeline items={timelineItems} />
    </div>
  );
}

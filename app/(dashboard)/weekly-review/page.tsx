"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  Button,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  Typography,
  Tag,
  App,
  DatePicker,
} from "antd";
import { RobotOutlined } from "@ant-design/icons";
import { WeeklyReview } from "@prisma/client";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

const { Text, Paragraph } = Typography;

export default function WeeklyReviewPage() {
  const { message } = App.useApp();
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(dayjs().startOf("isoWeek"));

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/weekly-review?limit=20");
      const data = await res.json();
      setReviews(data);
    } catch {
      console.error("Failed to fetch reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/weekly-review/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: selectedWeek.toISOString() }),
      });

      if (!res.ok) {
        const data = await res.json();
        message.error(data.error || "生成失败");
        return;
      }

      message.success("复盘报告已生成");
      fetchReviews();
    } catch {
      message.error("生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const currentWeekReview = reviews.find((r) =>
    dayjs(r.weekStart).isSame(selectedWeek, "week")
  );

  const parseImprovements = (improvements: string | null): string[] => {
    if (!improvements) return [];
    try {
      return JSON.parse(improvements);
    } catch {
      return [];
    }
  };

  const parseStatsByReason = (
    stats: string | null
  ): Record<string, { count: number; winRate: number; totalPnL: number }> => {
    if (!stats) return {};
    try {
      return JSON.parse(stats);
    } catch {
      return {};
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">周复盘</h1>
        <div className="flex items-center gap-4">
          <DatePicker
            picker="week"
            value={selectedWeek}
            onChange={(date) => date && setSelectedWeek(date.startOf("isoWeek"))}
            allowClear={false}
          />
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleGenerate}
            loading={generating}
            disabled={!!currentWeekReview}
          >
            {currentWeekReview ? "已生成" : "AI 生成复盘"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : currentWeekReview ? (
        <div className="space-y-6">
          <Card
            title={`${dayjs(currentWeekReview.weekStart).format("YYYY年第W周")} 复盘`}
            variant="borderless"
          >
            <Row gutter={16} className="mb-6">
              <Col span={6}>
                <Statistic
                  title="总交易次数"
                  value={currentWeekReview.totalTrades}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="胜率"
                  value={currentWeekReview.winRate || 0}
                  precision={1}
                  suffix="%"
                  styles={{ content: {
                    color:
                      (currentWeekReview.winRate || 0) >= 50
                        ? "var(--trading-up)"
                        : "var(--trading-down)",
                  } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="总盈亏"
                  value={currentWeekReview.totalPnL || 0}
                  precision={2}
                  styles={{ content: {
                    color:
                      (currentWeekReview.totalPnL || 0) >= 0
                        ? "var(--trading-up)"
                        : "var(--trading-down)",
                  } }}
                  prefix={(currentWeekReview.totalPnL || 0) >= 0 ? "+" : ""}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="最大回撤"
                  value={currentWeekReview.maxDrawdown || 0}
                  precision={2}
                  styles={{ content: { color: "var(--trading-down)" } }}
                  prefix="-"
                />
              </Col>
            </Row>

            {currentWeekReview.summary && (
              <div className="mb-6">
                <Text strong className="block mb-2">
                  周总结
                </Text>
                <Paragraph className="!text-muted-foreground">
                  {currentWeekReview.summary}
                </Paragraph>
              </div>
            )}

            {Object.keys(parseStatsByReason(currentWeekReview.statsByReason))
              .length > 0 && (
              <div className="mb-6">
                <Text strong className="block mb-2">
                  按入场理由统计
                </Text>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(
                    parseStatsByReason(currentWeekReview.statsByReason)
                  ).map(([reason, stats]) => (
                    <Card key={reason} size="small" className="!bg-secondary/30">
                      <div className="font-medium mb-1">{reason}</div>
                      <div className="text-sm text-muted-foreground">
                        <div>交易: {stats.count}次</div>
                        <div>胜率: {(stats.winRate * 100).toFixed(1)}%</div>
                        <div
                          className={
                            stats.totalPnL >= 0 ? "text-up" : "text-down"
                          }
                        >
                          盈亏: {stats.totalPnL >= 0 ? "+" : ""}
                          {stats.totalPnL.toFixed(2)}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {parseImprovements(currentWeekReview.improvements).length > 0 && (
              <div>
                <Text strong className="block mb-2">
                  <RobotOutlined className="mr-1" />
                  AI 改进建议
                </Text>
                <div className="space-y-2">
                  {parseImprovements(currentWeekReview.improvements).map((item, index) => (
                    <div key={index} className="flex items-center gap-2 py-2">
                      <Tag color="blue">{index + 1}</Tag>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card variant="borderless">
          <Empty
            description={`${selectedWeek.format("YYYY年第W周")} 暂无复盘记录`}
            className="py-16"
          >
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleGenerate}
              loading={generating}
            >
              生成本周复盘
            </Button>
          </Empty>
        </Card>
      )}

      {reviews.length > 0 && (
        <Card title="历史复盘" variant="borderless" className="mt-6">
          <div className="divide-y divide-border">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="flex justify-between w-full cursor-pointer hover:bg-secondary/30 px-4 py-3 rounded"
                onClick={() =>
                  setSelectedWeek(dayjs(review.weekStart).startOf("isoWeek"))
                }
              >
                <div>
                  <Text strong>
                    {dayjs(review.weekStart).format("YYYY年第W周")}
                  </Text>
                  <Text type="secondary" className="ml-4">
                    {review.totalTrades} 笔交易
                  </Text>
                </div>
                <div className="flex items-center gap-4">
                  <span>胜率: {(review.winRate || 0).toFixed(1)}%</span>
                  <span
                    className={
                      (review.totalPnL || 0) >= 0 ? "text-up" : "text-down"
                    }
                  >
                    {(review.totalPnL || 0) >= 0 ? "+" : ""}
                    {(review.totalPnL || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

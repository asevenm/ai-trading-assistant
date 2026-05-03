"use client"

import { useRouter } from "next/navigation"
import { Badge, Popover, Button, Typography, Tag, Empty, Spin } from "antd"
import { BellOutlined, CheckOutlined, RightOutlined } from "@ant-design/icons"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import "dayjs/locale/zh-cn"
import { useAlertStore } from "@/store/useAlertStore"
import { ALERT_TYPE_LABELS, ALERT_TYPE_COLORS, type AlertType } from "@/lib/alert-scanner"
import { useAlertScanner, requestNotificationPermission } from "./useAlertScanner"
import { useEffect } from "react"

dayjs.extend(relativeTime)
dayjs.locale("zh-cn")

const { Text } = Typography

export function AlertBell() {
  const router = useRouter()
  const { unreadCount, alerts, popoverOpen, setPopoverOpen, markAllRead } =
    useAlertStore()
  const { isScanning } = useAlertScanner()

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readAll: true }),
      })
      markAllRead()
    } catch (error) {
      console.error("Failed to mark all read:", error)
    }
  }

  const recentAlerts = alerts.slice(0, 8)

  const content = (
    <div className="w-[380px]">
      <div className="flex items-center justify-between px-1 pb-3 border-b border-border">
        <Text strong>异动提醒</Text>
        <div className="flex items-center gap-2">
          {isScanning && <Spin size="small" />}
          {unreadCount > 0 && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={handleMarkAllRead}
            >
              全部已读
            </Button>
          )}
        </div>
      </div>

      {recentAlerts.length === 0 ? (
        <div className="py-8">
          <Empty description="暂无异动提醒" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto">
          {recentAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`px-2 py-2.5 border-b border-border/50 cursor-pointer hover:bg-white/5 transition-colors ${
                !alert.read ? "bg-blue-500/5" : ""
              }`}
              onClick={() => {
                setPopoverOpen(false)
                router.push("/alerts")
              }}
            >
              <div className="flex items-start gap-2">
                {!alert.read && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Tag
                      color={ALERT_TYPE_COLORS[alert.type as AlertType] || "default"}
                      className="!text-xs !mr-0"
                    >
                      {ALERT_TYPE_LABELS[alert.type as AlertType] || alert.type}
                    </Tag>
                    <Text className="!text-xs !text-muted-foreground">
                      {dayjs(alert.createdAt).fromNow()}
                    </Text>
                  </div>
                  <Text className="!text-sm block truncate">{alert.message}</Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 text-center border-t border-border">
        <Button
          type="link"
          size="small"
          onClick={() => {
            setPopoverOpen(false)
            router.push("/alerts")
          }}
        >
          查看全部 <RightOutlined />
        </Button>
      </div>
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      placement="bottomRight"
      arrow={false}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined className="!text-lg" />}
          className="!text-foreground"
        />
      </Badge>
    </Popover>
  )
}

/**
 * 调度器辅助 - 交易日判断 + 容错时间窗 + 北京时间转换
 *
 * 设计要点：
 * - cron 任务可能因网络延迟在指定时间后 1-3 分钟才执行
 *   所以 timeSlot 判断使用更宽的容错窗口（每个槽 ±5 分钟）
 * - 节假日维护成本：每年初手动更新 CN_HOLIDAYS_2026 列表
 * - 部署在非北京时区时，必须以北京时间为准做交易日判断
 */

import type { TimeSlot } from "../types"

/**
 * A股 2026 年节假日（含调休补班的工作日仍为交易日不在此列）
 * 数据来源：国务院办公厅公布的法定节假日
 *
 * 注意：每年 12 月需要手动更新次年节假日
 */
const CN_HOLIDAYS_2026 = new Set<string>([
  // 元旦
  "2026-01-01",
  "2026-01-02",
  // 春节（2/16=春节当天）
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-23",
  "2026-02-24",
  // 清明
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  // 劳动节
  "2026-05-01",
  "2026-05-04",
  "2026-05-05",
  // 端午
  "2026-06-19",
  "2026-06-22",
  // 中秋 + 国庆连休
  "2026-09-25",
  "2026-10-01",
  "2026-10-02",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
  "2026-10-08",
])

/**
 * 取北京时间（无论服务器在哪个时区）
 */
export function getBeijingTime(now: Date = new Date()): Date {
  // toLocaleString 在 zh-CN + Asia/Shanghai 下返回 "2026/5/1 14:30:00"
  // 然后用 new Date(parts) 重建日期
  const parts = now.toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  // parts 形如 "05/01/2026, 14:30:00"
  return new Date(parts.replace(",", ""))
}

/**
 * 判断是否交易日（工作日 + 不在节假日）
 */
export function isTradingDay(now: Date = new Date()): boolean {
  const bj = getBeijingTime(now)
  const day = bj.getDay() // 0=周日, 6=周六
  if (day === 0 || day === 6) return false

  const y = bj.getFullYear()
  const m = String(bj.getMonth() + 1).padStart(2, "0")
  const d = String(bj.getDate()).padStart(2, "0")
  const dateStr = `${y}-${m}-${d}`

  return !CN_HOLIDAYS_2026.has(dateStr)
}

/**
 * 容错时间窗 - 每个 cron 期望触发时间附近 ±toleranceMin 分钟内都映射到同一个 slot
 *
 * 期望触发时间：
 *   PRE_OPEN: 09:15  (开盘前 10 分钟)
 *   0930:     09:35
 *   1030:     10:30
 *   1100:     11:25  (午休前 5 分钟)
 *   1330:     13:30
 *   1430:     14:30
 *   CLOSE:    15:05  (收盘后 5 分钟，等待数据稳定)
 */
const SCHEDULED_SLOTS: { slot: TimeSlot; hour: number; minute: number }[] = [
  { slot: "PRE_OPEN", hour: 9, minute: 15 },
  { slot: "0930", hour: 9, minute: 35 },
  { slot: "1030", hour: 10, minute: 30 },
  { slot: "1100", hour: 11, minute: 25 },
  { slot: "1330", hour: 13, minute: 30 },
  { slot: "1430", hour: 14, minute: 30 },
  { slot: "CLOSE", hour: 15, minute: 5 },
]

const SCHEDULE_TOLERANCE_MIN = 8

/**
 * 找到当前北京时间对应的"调度槽"。如果不在任何容错窗口内，返回 null。
 *
 * 用于 cron endpoint：cron 工具因网络/排队可能晚 1-3 分钟才打 endpoint，
 * 不能用严格匹配。
 */
export function getScheduledSlot(now: Date = new Date()): TimeSlot | null {
  const bj = getBeijingTime(now)
  const minute = bj.getHours() * 60 + bj.getMinutes()

  for (const s of SCHEDULED_SLOTS) {
    const target = s.hour * 60 + s.minute
    if (Math.abs(minute - target) <= SCHEDULE_TOLERANCE_MIN) {
      return s.slot
    }
  }
  return null
}

export const SCHEDULE_TIMES = SCHEDULED_SLOTS.map((s) => ({
  slot: s.slot,
  beijingTime: `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`,
}))

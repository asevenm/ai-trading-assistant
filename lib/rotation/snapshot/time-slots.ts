/**
 * 时间槽工具 - 把当前时间映射到 7 个固定快照点
 *
 * PRE_OPEN  : 开盘前 (09:00-09:24)
 * 0930      : 开盘后 30 分钟内 (09:25-10:00)
 * 1030      : 上午中段 (10:00-10:45)
 * 1100      : 上午尾盘 (10:45-11:30)
 * 1330      : 午后开盘 (13:00-14:00)
 * 1430      : 午后尾盘 (14:00-14:50)
 * CLOSE     : 收盘 (14:50-15:30)
 */

import type { TimeSlot } from "../types"

export const TIME_SLOTS: TimeSlot[] = [
  "PRE_OPEN",
  "0930",
  "1030",
  "1100",
  "1330",
  "1430",
  "CLOSE",
]

interface SlotRange {
  slot: TimeSlot
  startMin: number // 当日 0:00 起的分钟数
  endMin: number
}

const SLOT_RANGES: SlotRange[] = [
  { slot: "PRE_OPEN", startMin: 9 * 60, endMin: 9 * 60 + 24 },
  { slot: "0930", startMin: 9 * 60 + 25, endMin: 10 * 60 },
  { slot: "1030", startMin: 10 * 60, endMin: 10 * 60 + 45 },
  { slot: "1100", startMin: 10 * 60 + 45, endMin: 11 * 60 + 30 },
  { slot: "1330", startMin: 13 * 60, endMin: 14 * 60 },
  { slot: "1430", startMin: 14 * 60, endMin: 14 * 60 + 50 },
  { slot: "CLOSE", startMin: 14 * 60 + 50, endMin: 15 * 60 + 30 },
]

/**
 * 把当前时间映射到所在的时间槽。如果非交易时段，返回 null。
 */
export function getCurrentTimeSlot(now: Date = new Date()): TimeSlot | null {
  const minute = now.getHours() * 60 + now.getMinutes()
  const range = SLOT_RANGES.find((r) => minute >= r.startMin && minute < r.endMin)
  return range?.slot ?? null
}

/**
 * 取上一个时间槽（同一交易日内）。
 * 若当前是 PRE_OPEN 或第一个槽，返回 null。
 */
export function getPreviousTimeSlot(slot: TimeSlot): TimeSlot | null {
  const idx = TIME_SLOTS.indexOf(slot)
  if (idx <= 0) return null
  return TIME_SLOTS[idx - 1] ?? null
}

/**
 * 当日交易日字符串 YYYY-MM-DD（北京时区）
 */
export function getTradeDate(now: Date = new Date()): string {
  // 简化：直接用本地时区。生产环境若部署在非 +8 时区需要调整。
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * 把 trade date 转为 YYYYMMDD 格式（东财 API 用）
 */
export function toYYYYMMDD(tradeDate: string): string {
  return tradeDate.replace(/-/g, "")
}

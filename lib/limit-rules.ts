/**
 * A股涨跌停规则 — 单一真相源
 *
 * 板块涨跌停限制：
 * - 主板（沪/深 60xxxx, 00xxxx, 002xxx, 003xxx, 200xxx, 900xxx）: ±10%
 * - 创业板（300xxx, 301xxx）: ±20%
 * - 科创板（688xxx, 689xxx）: ±20%
 * - 北交所（8xxxxx, 4xxxxx, 920xxx）: ±30%
 * - 主板 ST/*ST: ±5%（仅主板生效；创业板/科创板注册制下 ST 仍 ±20%；北交所 ST 仍 ±30%）
 *
 * 浮点容忍：东财返回的涨跌幅经过四舍五入会出现 19.98%/19.99% 这类边界值
 * （例：23.87 × 1.2 = 28.644 → 28.64，反算涨幅 19.98%），使用 0.1% 容忍。
 */

export type BoardType = "main" | "chinext" | "star" | "bse" | "unknown"

const ST_PATTERN = /\*?ST/i
const FLOAT_TOLERANCE = 0.1

export function isStName(name?: string | null): boolean {
  if (!name) return false
  return ST_PATTERN.test(name.trim())
}

export function getBoardType(code: string | null | undefined): BoardType {
  if (!code) return "unknown"
  // ChiNext (创业板)
  if (code.startsWith("300") || code.startsWith("301")) return "chinext"
  // STAR Market (科创板)
  if (code.startsWith("688") || code.startsWith("689")) return "star"
  // Beijing Stock Exchange (北交所)
  if (code.startsWith("8") || code.startsWith("4") || code.startsWith("920")) {
    return "bse"
  }
  // Main board (沪深主板/原中小板/B股)
  if (
    code.startsWith("60") ||
    code.startsWith("00") ||
    code.startsWith("200") ||
    code.startsWith("900")
  ) {
    return "main"
  }
  return "unknown"
}

/**
 * 涨停涨幅百分比（正数）
 *
 * ST 规则：±5% 只适用于沪深**主板** ST/*ST。
 * - 创业板/科创板注册制下，ST 股票仍按板块原值 ±20%
 * - 北交所 ST 维持 ±30%
 */
export function getLimitUpPercent(code: string, name?: string | null): number {
  const board = getBoardType(code)
  if (isStName(name) && board === "main") return 5
  switch (board) {
    case "chinext":
    case "star":
      return 20
    case "bse":
      return 30
    case "main":
    default:
      return 10
  }
}

/**
 * 跌停跌幅百分比（负数）
 */
export function getLimitDownPercent(code: string, name?: string | null): number {
  return -getLimitUpPercent(code, name)
}

/**
 * 是否已涨停（含浮点容忍）
 */
export function isLimitUp(
  code: string,
  changePercent: number,
  name?: string | null
): boolean {
  const limit = getLimitUpPercent(code, name)
  return changePercent >= limit - FLOAT_TOLERANCE
}

/**
 * 是否已跌停（含浮点容忍）
 */
export function isLimitDown(
  code: string,
  changePercent: number,
  name?: string | null
): boolean {
  const limit = getLimitDownPercent(code, name)
  return changePercent <= limit + FLOAT_TOLERANCE
}

/**
 * 是否逼近涨停 — 距离涨停 distance 个百分点以内、且尚未封板
 * 默认 distance = 2
 */
export function isNearLimitUp(
  code: string,
  changePercent: number,
  distance: number = 2,
  name?: string | null
): boolean {
  if (isLimitUp(code, changePercent, name)) return false
  const limit = getLimitUpPercent(code, name)
  return changePercent >= limit - distance
}

/**
 * 距离涨停的百分点（>=0；已涨停返回 0）
 */
export function distanceToLimitUp(
  code: string,
  changePercent: number,
  name?: string | null
): number {
  const limit = getLimitUpPercent(code, name)
  return Math.max(0, limit - changePercent)
}

/**
 * 涨停价（按 0.01 元四舍五入）
 */
export function getLimitUpPrice(
  code: string,
  prevClose: number,
  name?: string | null
): number {
  const factor = 1 + getLimitUpPercent(code, name) / 100
  return Math.round(prevClose * factor * 100) / 100
}

/**
 * 跌停价（按 0.01 元四舍五入）
 */
export function getLimitDownPrice(
  code: string,
  prevClose: number,
  name?: string | null
): number {
  const factor = 1 + getLimitDownPercent(code, name) / 100
  return Math.round(prevClose * factor * 100) / 100
}

// Technical indicators - pure functions, no side effects

export interface MACDResult {
  dif: number[]
  dea: number[]
  macd: number[]
}

export interface BollResult {
  upper: number[]
  mid: number[]
  lower: number[]
}

export function calculateMA(closes: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
  }
  return result
}

export function calculateEMA(closes: number[], period: number): number[] {
  const result: number[] = []
  const multiplier = 2 / (period + 1)

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(closes[0])
    } else {
      const ema = (closes[i] - result[i - 1]) * multiplier + result[i - 1]
      result.push(ema)
    }
  }
  return result
}

export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const emaFast = calculateEMA(closes, fastPeriod)
  const emaSlow = calculateEMA(closes, slowPeriod)

  const dif: number[] = []
  for (let i = 0; i < closes.length; i++) {
    dif.push(emaFast[i] - emaSlow[i])
  }

  const dea = calculateEMA(dif, signalPeriod)

  const macd: number[] = []
  for (let i = 0; i < closes.length; i++) {
    macd.push((dif[i] - dea[i]) * 2)
  }

  return { dif, dea, macd }
}

export function calculateRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [NaN]

  const gains: number[] = []
  const losses: number[] = []

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? -change : 0)

    if (i < period) {
      result.push(NaN)
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    } else {
      // Simplified: use Wilder's smoothing
      const avgGain =
        (gains.slice(i - period, i - 1).reduce((a, b) => a + b, 0) + gains[i - 1]) / period
      const avgLoss =
        (losses.slice(i - period, i - 1).reduce((a, b) => a + b, 0) + losses[i - 1]) / period

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }

  return result
}

export function calculateBoll(
  closes: number[],
  period: number = 20,
  multiplier: number = 2
): BollResult {
  const mid = calculateMA(closes, period)
  const upper: number[] = []
  const lower: number[] = []

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN)
      lower.push(NaN)
    } else {
      const slice = closes.slice(i - period + 1, i + 1)
      const mean = mid[i]
      const stdDev = Math.sqrt(
        slice.reduce((sum, val) => sum + (val - mean) ** 2, 0) / period
      )
      upper.push(mean + multiplier * stdDev)
      lower.push(mean - multiplier * stdDev)
    }
  }

  return { upper, mid, lower }
}

// Helper: check if MA lines are in bullish alignment
export function isMaBullish(
  ma5: number,
  ma10: number,
  ma20: number,
  ma60: number
): boolean {
  return (
    !isNaN(ma5) &&
    !isNaN(ma10) &&
    !isNaN(ma20) &&
    !isNaN(ma60) &&
    ma5 > ma10 &&
    ma10 > ma20 &&
    ma20 > ma60
  )
}

// Helper: check for MACD golden cross (DIF crosses above DEA)
export function isMacdGoldenCross(
  dif: number[],
  dea: number[],
  index: number
): boolean {
  if (index < 1) return false
  return (
    dif[index] > dea[index] &&
    dif[index - 1] <= dea[index - 1]
  )
}

// Helper: check for volume breakout
export function isVolumeBreakout(
  volumes: number[],
  index: number,
  avgPeriod: number = 5,
  multiplier: number = 1.5
): boolean {
  if (index < avgPeriod) return false
  const avgVolume =
    volumes.slice(index - avgPeriod, index).reduce((a, b) => a + b, 0) / avgPeriod
  return volumes[index] > avgVolume * multiplier
}

// Helper: check if price hits 20-day high
export function isNewHigh(
  closes: number[],
  index: number,
  period: number = 20
): boolean {
  if (index < period) return false
  const slice = closes.slice(index - period, index)
  return closes[index] >= Math.max(...slice)
}

// Helper: check if stock is pulling back to MA support (龙回头)
// Strong stock that pulled back to MA10 or MA20 support
export function isDragonPullback(
  closes: number[],
  highs: number[],
  volumes: number[],
  index: number
): { matched: boolean; supportMA: string; pullbackDays: number } {
  if (index < 60) return { matched: false, supportMA: "", pullbackDays: 0 }

  const ma10 = calculateMA(closes, 10)
  const ma20 = calculateMA(closes, 20)
  const ma60 = calculateMA(closes, 60)

  // Check recent strength: in the past 20 days, had a surge >=15% over 5 days
  let hadSurge = false
  for (let i = index - 20; i <= index - 3; i++) {
    if (i < 5) continue
    const fiveDayReturn = (closes[i] - closes[i - 5]) / closes[i - 5] * 100
    if (fiveDayReturn >= 15) {
      hadSurge = true
      break
    }
  }
  if (!hadSurge) return { matched: false, supportMA: "", pullbackDays: 0 }

  // Count pullback days (consecutive days closing lower)
  let pullbackDays = 0
  for (let i = index; i > index - 10 && i > 0; i--) {
    if (closes[i] < closes[i - 1]) pullbackDays++
    else break
  }

  // Must have pulled back at least 2 days
  if (pullbackDays < 2) return { matched: false, supportMA: "", pullbackDays: 0 }

  const currentPrice = closes[index]
  const currentMA10 = ma10[index]
  const currentMA20 = ma20[index]

  // Price near MA10 support (within 2%)
  const nearMA10 = Math.abs(currentPrice - currentMA10) / currentMA10 < 0.02
  // Price near MA20 support (within 2%)
  const nearMA20 = Math.abs(currentPrice - currentMA20) / currentMA20 < 0.02

  // MA60 should be trending up (bullish background)
  const ma60Rising = !isNaN(ma60[index]) && !isNaN(ma60[index - 5]) && ma60[index] > ma60[index - 5]

  if ((nearMA10 || nearMA20) && ma60Rising) {
    return {
      matched: true,
      supportMA: nearMA10 ? "MA10" : "MA20",
      pullbackDays,
    }
  }

  return { matched: false, supportMA: "", pullbackDays: 0 }
}

// Helper: check for bottom reversal (底部反转)
// Long downtrend followed by first high-volume bullish candle
export function isBottomReversal(
  closes: number[],
  opens: number[],
  volumes: number[],
  index: number
): { matched: boolean; downDays: number; volumeRatio: number } {
  if (index < 30) return { matched: false, downDays: 0, volumeRatio: 0 }

  // Check 20-day decline: price should have dropped at least 15% in past 20 days
  const high20 = Math.max(...closes.slice(Math.max(0, index - 20), index))
  const decline = (high20 - closes[index - 1]) / high20 * 100
  if (decline < 15) return { matched: false, downDays: 0, volumeRatio: 0 }

  // Count down days in last 20 sessions
  let downDays = 0
  for (let i = index - 20; i < index; i++) {
    if (i > 0 && closes[i] < closes[i - 1]) downDays++
  }
  if (downDays < 12) return { matched: false, downDays: 0, volumeRatio: 0 }

  // Today must be bullish candle (close > open) with positive change
  const isBullish = closes[index] > opens[index]
  const changePercent = (closes[index] - closes[index - 1]) / closes[index - 1] * 100
  if (!isBullish || changePercent < 2) return { matched: false, downDays: 0, volumeRatio: 0 }

  // Volume should be at least 1.5x of 10-day average
  const avgVol10 = volumes.slice(index - 10, index).reduce((a, b) => a + b, 0) / 10
  const volumeRatio = volumes[index] / avgVol10
  if (volumeRatio < 1.5) return { matched: false, downDays: 0, volumeRatio: 0 }

  return { matched: true, downDays, volumeRatio }
}

// Helper: check for platform breakout (突破平台)
// Consolidation for >= 10 days then breaking above the range
export function isPlatformBreakout(
  closes: number[],
  highs: number[],
  volumes: number[],
  index: number,
  consolidationDays: number = 10
): { matched: boolean; platformHigh: number; breakoutVolRatio: number } {
  if (index < consolidationDays + 5) return { matched: false, platformHigh: 0, breakoutVolRatio: 0 }

  // Look at the range from (index - consolidationDays) to (index - 1)
  const rangeCloses = closes.slice(index - consolidationDays, index)
  const rangeHighs = highs.slice(index - consolidationDays, index)
  const rangeHigh = Math.max(...rangeHighs)
  const rangeLow = Math.min(...rangeCloses)

  // Range amplitude should be within 8% (tight consolidation)
  const amplitude = (rangeHigh - rangeLow) / rangeLow * 100
  if (amplitude > 8) return { matched: false, platformHigh: 0, breakoutVolRatio: 0 }

  // Today's close must break above range high
  if (closes[index] <= rangeHigh) return { matched: false, platformHigh: 0, breakoutVolRatio: 0 }

  // Volume should increase (>1.3x average of consolidation period)
  const avgVol = volumes.slice(index - consolidationDays, index).reduce((a, b) => a + b, 0) / consolidationDays
  const breakoutVolRatio = volumes[index] / avgVol

  if (breakoutVolRatio < 1.3) return { matched: false, platformHigh: 0, breakoutVolRatio: 0 }

  return { matched: true, platformHigh: rangeHigh, breakoutVolRatio }
}

// Helper: check for low-volume pullback in uptrend (缩量回踩)
// Uptrending stock with volume decreasing on pullback to MA
export function isLowVolumePullback(
  closes: number[],
  volumes: number[],
  index: number
): { matched: boolean; supportMA: string; volumeShrink: number } {
  if (index < 30) return { matched: false, supportMA: "", volumeShrink: 0 }

  const ma5 = calculateMA(closes, 5)
  const ma10 = calculateMA(closes, 10)
  const ma20 = calculateMA(closes, 20)

  // Uptrend check: MA10 > MA20 and MA20 is rising
  if (isNaN(ma10[index]) || isNaN(ma20[index])) return { matched: false, supportMA: "", volumeShrink: 0 }
  if (ma10[index] <= ma20[index]) return { matched: false, supportMA: "", volumeShrink: 0 }

  const ma20Rising = ma20[index] > ma20[index - 5]
  if (!ma20Rising) return { matched: false, supportMA: "", volumeShrink: 0 }

  // Price pulled back near MA5 or MA10
  const nearMA5 = Math.abs(closes[index] - ma5[index]) / ma5[index] < 0.015
  const nearMA10 = Math.abs(closes[index] - ma10[index]) / ma10[index] < 0.02

  if (!nearMA5 && !nearMA10) return { matched: false, supportMA: "", volumeShrink: 0 }

  // Volume should be shrinking: today's volume < 70% of 5-day average
  const avgVol5 = volumes.slice(index - 5, index).reduce((a, b) => a + b, 0) / 5
  const volumeShrink = volumes[index] / avgVol5

  if (volumeShrink > 0.7) return { matched: false, supportMA: "", volumeShrink: 0 }

  return {
    matched: true,
    supportMA: nearMA5 ? "MA5" : "MA10",
    volumeShrink,
  }
}

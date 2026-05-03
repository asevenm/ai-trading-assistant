/**
 * 关键事件检测 - 在快照写入后调用，检测：
 *
 * - RISING_BREAKOUT: 强度分首次破 75（新主升出现）
 * - STARTING_SIGNAL: 强度分破 60 + 加速上行（启动信号）
 * - LEADER_BROKEN:   龙头炸板（硬触发，已在 stage classifier 内打 DIVERGING）
 * - FADING_SIGNAL:   强度分跌破 50 且 ΔS<-10
 * - STAGE_CHANGE:    阶段变化（一般性提示）
 */

import type {
  BoardRawMetrics,
  RotationEventType,
  RotationStage,
  TimeSlot,
} from "../types"

export interface DetectInput {
  tradeDate: string
  timeSlot: TimeSlot
  board: BoardRawMetrics
  currentStage: RotationStage | null
  previousStage: string | null // 上一快照的 stage（DB 里是 string）
  currentScore: number
  previousScore: number | null
  deltaScore: number | null
  leaderBusted: boolean
}

export interface DetectedEvent {
  eventType: RotationEventType
  fromStage: string | null
  toStage: string | null
  payload: Record<string, unknown>
}

const RISING_THRESHOLD = 75
const STARTING_THRESHOLD = 60
const FADING_THRESHOLD = 50

export function detectEvents(input: DetectInput): DetectedEvent[] {
  const events: DetectedEvent[] = []
  const {
    board,
    currentStage,
    previousStage,
    currentScore,
    previousScore,
    deltaScore,
    leaderBusted,
  } = input

  // 1. RISING_BREAKOUT: 上一快照 < 75 且当前 ≥ 75
  if (
    currentScore >= RISING_THRESHOLD &&
    previousScore !== null &&
    previousScore < RISING_THRESHOLD
  ) {
    events.push({
      eventType: "RISING_BREAKOUT",
      fromStage: previousStage,
      toStage: currentStage,
      payload: {
        boardName: board.boardName,
        previousScore,
        currentScore,
        leaderStocks: board.leaderStocks,
        topStreak: board.topStreak,
      },
    })
  }

  // 2. STARTING_SIGNAL: 当前阶段是 STARTING（已经过了硬规则判定）
  if (currentStage === "STARTING" && previousStage !== "STARTING") {
    events.push({
      eventType: "STARTING_SIGNAL",
      fromStage: previousStage,
      toStage: currentStage,
      payload: {
        boardName: board.boardName,
        currentScore,
        deltaScore,
        limitUpCount: board.limitUpCount,
      },
    })
  }

  // 3. LEADER_BROKEN: 龙头炸板（hard rule）
  if (leaderBusted) {
    events.push({
      eventType: "LEADER_BROKEN",
      fromStage: previousStage,
      toStage: currentStage,
      payload: {
        boardName: board.boardName,
        leaderStocks: board.leaderStocks,
        currentScore,
      },
    })
  }

  // 4. FADING_SIGNAL: 跌破 50 + ΔS<-10
  if (
    currentScore < FADING_THRESHOLD &&
    previousScore !== null &&
    previousScore >= FADING_THRESHOLD &&
    deltaScore !== null &&
    deltaScore < -10
  ) {
    events.push({
      eventType: "FADING_SIGNAL",
      fromStage: previousStage,
      toStage: currentStage,
      payload: {
        boardName: board.boardName,
        previousScore,
        currentScore,
        deltaScore,
      },
    })
  }

  // 5. STAGE_CHANGE: 一般阶段变化（避免和上面重复，只记录"未被上面 4 个细分事件覆盖"的变化）
  const alreadyCovered = events.some((e) =>
    ["RISING_BREAKOUT", "STARTING_SIGNAL", "LEADER_BROKEN", "FADING_SIGNAL"].includes(e.eventType)
  )
  if (
    !alreadyCovered &&
    currentStage &&
    currentStage !== previousStage &&
    previousStage // 仅在有上一阶段时记录变化
  ) {
    events.push({
      eventType: "STAGE_CHANGE",
      fromStage: previousStage,
      toStage: currentStage,
      payload: {
        boardName: board.boardName,
        currentScore,
        deltaScore,
      },
    })
  }

  return events
}

// 数据库阈值常量同步导出，方便看板使用
export { RISING_THRESHOLD, STARTING_THRESHOLD, FADING_THRESHOLD }

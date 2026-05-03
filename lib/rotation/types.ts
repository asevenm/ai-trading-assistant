/**
 * 轮动作战系统 - 共享类型
 *
 * 设计文档：docs/plans/2026-05-01-rotation-system-design.md
 */

export type BoardType = "INDUSTRY" | "CONCEPT"

export type TimeSlot =
  | "PRE_OPEN"
  | "0930"
  | "1030"
  | "1100"
  | "1330"
  | "1430"
  | "CLOSE"

export type RotationStage =
  | "STARTING" // 启动 🟢
  | "RISING" // 主升 🔥
  | "DIVERGING" // 分歧 ⚠️
  | "FADING" // 退潮 🔻

export type RotationEventType =
  | "RISING_BREAKOUT" // 强度分破 75 进入主升
  | "STARTING_SIGNAL" // 强度分破 60 + 加速上行
  | "LEADER_BROKEN" // 龙头炸板（硬触发分歧）
  | "FADING_SIGNAL" // 强度分跌破 50 + 龙头大跌
  | "STAGE_CHANGE" // 一般阶段变化

/**
 * 板块原始指标（采集层输出，未评分）
 */
export interface BoardRawMetrics {
  boardType: BoardType
  boardId: string
  boardName: string

  // 6 维原始指标
  changePct: number
  limitUpCount: number
  mainNetInflow: number
  topStreak: number
  turnoverRate: number
  newsHeat: number

  // 龙头股代码（用于硬规则：炸板检测）
  leaderStocks: string[]
}

/**
 * 板块强度评分结果
 */
export interface BoardScore {
  strengthScore: number // 0-100
  components: {
    changePctScore: number
    limitUpScore: number
    mainInflowScore: number
    streakScore: number
    turnoverScore: number
    newsScore: number
  }
}

/**
 * 完整快照（评分 + 阶段 + 趋势）
 */
export interface BoardSnapshotEntry extends BoardRawMetrics, BoardScore {
  deltaScore: number | null // ΔS vs 上一快照
  accelScore: number | null // Δ²S
  stage: RotationStage | null
  stageReason: string | null
}

/**
 * 评分权重 (合计 100%)
 */
export const SCORE_WEIGHTS = {
  changePct: 0.2, // 涨幅强度 20%
  limitUp: 0.25, // 涨停密度 25%
  mainInflow: 0.2, // 主力净流入 20%
  streak: 0.2, // 龙头高度 20%
  turnover: 0.1, // 活跃度 10%
  news: 0.05, // 消息热度 5%
} as const

/**
 * 阶段判定阈值
 */
export const STAGE_THRESHOLDS = {
  // 启动 🟢: S<60, ΔS>+15, Δ²S>0
  starting: { maxScore: 60, minDelta: 15, minAccel: 0 },
  // 主升 🔥: S≥75, ΔS>0
  rising: { minScore: 75, minDelta: 0 },
  // 分歧 ⚠️: S≥70, Δ²S<0
  diverging: { minScore: 70, maxAccel: 0 },
  // 退潮 🔻: S<50, ΔS<-10
  fading: { maxScore: 50, maxDelta: -10 },
} as const

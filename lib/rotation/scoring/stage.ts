/**
 * 阶段判定 - 4 阶段分类（启动/主升/分歧/退潮）+ 硬规则（龙头炸板）
 *
 * 输入：当前快照评分 + 上一快照评分（用于计算 ΔS）+ 上上快照评分（用于计算 Δ²S）
 * 输出：阶段标签 + 触发原因
 *
 * 决策树：
 *   if (leaderBusted) → DIVERGING (硬规则，最高优先级)
 *   else if (S<60 && ΔS>15 && Δ²S>0) → STARTING
 *   else if (S>=75 && ΔS>0 && 持续) → RISING
 *   else if (S>=70 && Δ²S<0) → DIVERGING
 *   else if (S<50 && ΔS<-10) → FADING
 *   else → null（未入选）
 */

import { STAGE_THRESHOLDS, type RotationStage } from "../types"

export interface StageInput {
  strengthScore: number
  previousScore: number | null // 上一快照分数（用于 ΔS）
  previousDelta: number | null // 上一快照的 ΔS（用于 Δ²S）
  leaderBusted: boolean // 龙头炸板硬触发
  /** 主升判定需要"持续 ≥2 日"，传入是否有连续高强度的标记 */
  sustainedHighScore?: boolean
}

export interface StageOutput {
  stage: RotationStage | null
  stageReason: string | null
  deltaScore: number | null
  accelScore: number | null
}

export function classifyStage(input: StageInput): StageOutput {
  const { strengthScore, previousScore, previousDelta, leaderBusted, sustainedHighScore } = input

  const deltaScore = previousScore !== null ? round1(strengthScore - previousScore) : null
  const accelScore =
    deltaScore !== null && previousDelta !== null ? round1(deltaScore - previousDelta) : null

  // 硬规则 1: 龙头炸板 → 立即标记分歧（最高优先级）
  if (leaderBusted) {
    return {
      stage: "DIVERGING",
      stageReason: "硬规则：龙头炸板",
      deltaScore,
      accelScore,
    }
  }

  const t = STAGE_THRESHOLDS

  // 退潮 🔻
  if (
    strengthScore < t.fading.maxScore &&
    deltaScore !== null &&
    deltaScore < t.fading.maxDelta
  ) {
    return {
      stage: "FADING",
      stageReason: `S=${strengthScore} < 50 且 ΔS=${deltaScore} < -10`,
      deltaScore,
      accelScore,
    }
  }

  // 主升 🔥
  if (
    strengthScore >= t.rising.minScore &&
    deltaScore !== null &&
    deltaScore > t.rising.minDelta &&
    sustainedHighScore !== false
  ) {
    return {
      stage: "RISING",
      stageReason: `S=${strengthScore} ≥ 75 且 ΔS=${deltaScore} > 0`,
      deltaScore,
      accelScore,
    }
  }

  // 分歧 ⚠️
  if (
    strengthScore >= t.diverging.minScore &&
    accelScore !== null &&
    accelScore < t.diverging.maxAccel
  ) {
    return {
      stage: "DIVERGING",
      stageReason: `S=${strengthScore} ≥ 70 且 Δ²S=${accelScore} < 0（加速度转负）`,
      deltaScore,
      accelScore,
    }
  }

  // 启动 🟢
  if (
    strengthScore < t.starting.maxScore &&
    deltaScore !== null &&
    deltaScore > t.starting.minDelta &&
    accelScore !== null &&
    accelScore > t.starting.minAccel
  ) {
    return {
      stage: "STARTING",
      stageReason: `S=${strengthScore} < 60, ΔS=${deltaScore} > 15, Δ²S=${accelScore} > 0`,
      deltaScore,
      accelScore,
    }
  }

  return {
    stage: null,
    stageReason: null,
    deltaScore,
    accelScore,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

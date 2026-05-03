/**
 * 快照构建 + 入库
 *
 * 流程：
 * 1. 调用 assembleBoardMetrics 拿到所有候选板块的 6 维原始数据
 * 2. 对 industry / concept 各自打分（百分位归一化是分别做的）
 * 3. 读取上一快照（同一 boardId + tradeDate，找最近的 timeSlot）做 Δ/Δ² 计算
 * 4. 调用 classifyStage 判定阶段
 * 5. upsert BoardSnapshot
 * 6. 检测阶段变化 / 硬规则触发，写入 RotationEvent
 */

import { prisma } from "../../prisma"
import type { BoardRawMetrics, BoardScore, BoardType, RotationStage, TimeSlot } from "../types"
import { assembleBoardMetrics } from "../collectors/assemble"
import { scoreBoards } from "../scoring/score"
import { classifyStage } from "../scoring/stage"
import { TIME_SLOTS, getCurrentTimeSlot, getTradeDate } from "./time-slots"
import { detectEvents } from "../events/detect"

export interface TakeSnapshotOptions {
  /** 强制指定 timeSlot，否则按当前时间自动判断 */
  timeSlot?: TimeSlot
  /** 强制指定交易日，否则按当前日期 */
  tradeDate?: string
  /** 是否拉取换手率（默认 true，关闭可加速但会丢失活跃度维度） */
  withTurnover?: boolean
}

export interface SnapshotResult {
  tradeDate: string
  timeSlot: TimeSlot
  industryCount: number
  conceptCount: number
  stageStats: Record<RotationStage | "NONE", number>
  eventsCreated: number
  durationMs: number
}

export async function takeSnapshot(options: TakeSnapshotOptions = {}): Promise<SnapshotResult> {
  const startTime = Date.now()
  const tradeDate = options.tradeDate ?? getTradeDate()
  const timeSlot = options.timeSlot ?? getCurrentTimeSlot() ?? "CLOSE"

  // Step 1: 采集
  const assembled = await assembleBoardMetrics({
    withTurnover: options.withTurnover ?? true,
    topN: 50,
  })

  // Step 2: 分别打分（行业/概念归一化要分开做）
  const industryScores = scoreBoards(assembled.industry)
  const conceptScores = scoreBoards(assembled.concept)

  // Step 3-5: 入库
  const stageStats: Record<RotationStage | "NONE", number> = {
    STARTING: 0,
    RISING: 0,
    DIVERGING: 0,
    FADING: 0,
    NONE: 0,
  }

  const allEntries: Array<{
    metrics: BoardRawMetrics
    score: BoardScore
    leaderBusted: boolean
  }> = [
    ...assembled.industry.map((m, i) => ({
      metrics: m,
      score: industryScores[i]!,
      leaderBusted: assembled.leaderBustedMap.get(`INDUSTRY:${m.boardId}`) ?? false,
    })),
    ...assembled.concept.map((m, i) => ({
      metrics: m,
      score: conceptScores[i]!,
      leaderBusted: assembled.leaderBustedMap.get(`CONCEPT:${m.boardId}`) ?? false,
    })),
  ]

  let eventsCreated = 0

  for (const entry of allEntries) {
    const { metrics, score, leaderBusted } = entry

    // 找上一快照（同板块，同交易日内最近的 timeSlot；找不到则取上一交易日的 CLOSE）
    const prev = await findPreviousSnapshot(metrics.boardType, metrics.boardId, tradeDate, timeSlot)

    const stageOut = classifyStage({
      strengthScore: score.strengthScore,
      previousScore: prev?.strengthScore ?? null,
      previousDelta: prev?.deltaScore ?? null,
      leaderBusted,
      sustainedHighScore: prev ? prev.strengthScore >= 70 : true,
    })

    // 写入 BoardSnapshot
    await prisma.boardSnapshot.upsert({
      where: {
        tradeDate_timeSlot_boardType_boardId: {
          tradeDate,
          timeSlot,
          boardType: metrics.boardType,
          boardId: metrics.boardId,
        },
      },
      create: {
        tradeDate,
        timeSlot,
        boardType: metrics.boardType,
        boardId: metrics.boardId,
        boardName: metrics.boardName,
        changePct: metrics.changePct,
        limitUpCount: metrics.limitUpCount,
        mainNetInflow: metrics.mainNetInflow,
        topStreak: metrics.topStreak,
        turnoverRate: metrics.turnoverRate,
        newsHeat: metrics.newsHeat,
        strengthScore: score.strengthScore,
        deltaScore: stageOut.deltaScore,
        accelScore: stageOut.accelScore,
        stage: stageOut.stage,
        stageReason: stageOut.stageReason,
        leaderStocks: JSON.stringify(metrics.leaderStocks),
      },
      update: {
        boardName: metrics.boardName,
        changePct: metrics.changePct,
        limitUpCount: metrics.limitUpCount,
        mainNetInflow: metrics.mainNetInflow,
        topStreak: metrics.topStreak,
        turnoverRate: metrics.turnoverRate,
        newsHeat: metrics.newsHeat,
        strengthScore: score.strengthScore,
        deltaScore: stageOut.deltaScore,
        accelScore: stageOut.accelScore,
        stage: stageOut.stage,
        stageReason: stageOut.stageReason,
        leaderStocks: JSON.stringify(metrics.leaderStocks),
      },
    })

    stageStats[stageOut.stage ?? "NONE"]++

    // 检测事件
    const events = detectEvents({
      tradeDate,
      timeSlot,
      board: metrics,
      currentStage: stageOut.stage,
      previousStage: prev?.stage ?? null,
      currentScore: score.strengthScore,
      previousScore: prev?.strengthScore ?? null,
      deltaScore: stageOut.deltaScore,
      leaderBusted,
    })

    if (events.length > 0) {
      await prisma.rotationEvent.createMany({
        data: events.map((e) => ({
          tradeDate,
          timestamp: new Date(),
          eventType: e.eventType,
          boardType: metrics.boardType,
          boardId: metrics.boardId,
          boardName: metrics.boardName,
          fromStage: e.fromStage,
          toStage: e.toStage,
          payload: JSON.stringify(e.payload),
        })),
      })
      eventsCreated += events.length
    }
  }

  return {
    tradeDate,
    timeSlot,
    industryCount: assembled.industry.length,
    conceptCount: assembled.concept.length,
    stageStats,
    eventsCreated,
    durationMs: Date.now() - startTime,
  }
}

/**
 * 找前一个快照：先找同交易日同板块的最近 timeSlot，找不到回溯到上一交易日的 CLOSE
 */
async function findPreviousSnapshot(
  boardType: BoardType,
  boardId: string,
  tradeDate: string,
  currentSlot: TimeSlot
): Promise<{ strengthScore: number; deltaScore: number | null; stage: string | null } | null> {
  const currentIdx = TIME_SLOTS.indexOf(currentSlot)
  // 同交易日内更早的快照
  const earlierSlots = TIME_SLOTS.slice(0, Math.max(0, currentIdx))

  if (earlierSlots.length > 0) {
    const sameDay = await prisma.boardSnapshot.findFirst({
      where: {
        boardType,
        boardId,
        tradeDate,
        timeSlot: { in: earlierSlots },
      },
      orderBy: { timeSlot: "desc" },
      select: { strengthScore: true, deltaScore: true, stage: true },
    })
    if (sameDay) return sameDay
  }

  // 跨日：找上一个交易日的最后一个快照（按 tradeDate 倒序）
  const previousDay = await prisma.boardSnapshot.findFirst({
    where: {
      boardType,
      boardId,
      tradeDate: { lt: tradeDate },
    },
    orderBy: [{ tradeDate: "desc" }, { timeSlot: "desc" }],
    select: { strengthScore: true, deltaScore: true, stage: true },
  })
  return previousDay
}

/**
 * 题材阶段查询
 *
 * 把当前最新的 BoardSnapshot 整理成两类查询索引：
 *  1. boardId → stage（板块代码直接命中）
 *  2. boardName → stage（板块名/概念名匹配）
 *
 * 给 alert-scanner 等"事件流"模块用，让单点信号能挂上"题材当前在什么阶段"的上下文。
 */

import { prisma } from "../prisma"
import type { RotationStage } from "./types"
import { getTradeDate } from "./snapshot/time-slots"

export interface ThemeStageInfo {
  boardId: string
  boardName: string
  boardType: "INDUSTRY" | "CONCEPT"
  stage: RotationStage
  strengthScore: number
}

export interface StageLookup {
  byBoardId: Map<string, ThemeStageInfo>
  byBoardName: Map<string, ThemeStageInfo> // key 为 boardName 原值
  /** 找不到时返回 null；boardId 优先，再退到 boardName 全匹配 */
  lookup(opts: { boardId?: string | null; boardName?: string | null }): ThemeStageInfo | null
}

interface SnapshotRow {
  boardId: string
  boardName: string
  boardType: string
  stage: string | null
  strengthScore: number
  timeSlot: string
}

const SLOT_PRIORITY = ["CLOSE", "1430", "1330", "1100", "1030", "0930", "PRE_OPEN"]

function pickLatest(rows: SnapshotRow[]): SnapshotRow | null {
  if (rows.length === 0) return null
  // 按 timeSlot 优先级排序（CLOSE 最新），存在 null stage 也保留以保证至少有数据
  const sorted = [...rows].sort(
    (a, b) => SLOT_PRIORITY.indexOf(a.timeSlot) - SLOT_PRIORITY.indexOf(b.timeSlot),
  )
  return sorted[0] ?? null
}

/**
 * 构建当日（或指定日）阶段查询索引。
 * 优先用最新 timeSlot 的 stage；如果当日没有快照，回溯到上一个有数据的 tradeDate。
 */
export async function buildStageLookup(tradeDate?: string): Promise<StageLookup> {
  const targetDate = tradeDate ?? getTradeDate()

  // 当日的所有快照
  let rows = await prisma.boardSnapshot.findMany({
    where: { tradeDate: targetDate },
    select: {
      boardId: true,
      boardName: true,
      boardType: true,
      stage: true,
      strengthScore: true,
      timeSlot: true,
    },
  })

  // 当日无数据 → 回溯到最新一个有快照的 tradeDate
  if (rows.length === 0) {
    const latest = await prisma.boardSnapshot.findFirst({
      where: { tradeDate: { lt: targetDate } },
      orderBy: { tradeDate: "desc" },
      select: { tradeDate: true },
    })
    if (latest) {
      rows = await prisma.boardSnapshot.findMany({
        where: { tradeDate: latest.tradeDate },
        select: {
          boardId: true,
          boardName: true,
          boardType: true,
          stage: true,
          strengthScore: true,
          timeSlot: true,
        },
      })
    }
  }

  // 同 boardId 取最新 timeSlot
  const byBoardIdRaw = new Map<string, SnapshotRow[]>()
  for (const row of rows) {
    const list = byBoardIdRaw.get(row.boardId) ?? []
    list.push(row)
    byBoardIdRaw.set(row.boardId, list)
  }

  const byBoardId = new Map<string, ThemeStageInfo>()
  const byBoardName = new Map<string, ThemeStageInfo>()

  for (const [boardId, list] of byBoardIdRaw.entries()) {
    const latest = pickLatest(list)
    if (!latest || !latest.stage) continue

    const info: ThemeStageInfo = {
      boardId,
      boardName: latest.boardName,
      boardType: latest.boardType === "INDUSTRY" ? "INDUSTRY" : "CONCEPT",
      stage: latest.stage as RotationStage,
      strengthScore: latest.strengthScore,
    }

    byBoardId.set(boardId, info)

    // 同名时保留强度更高的那个（避免行业/概念同名时弱阶段覆盖强阶段）
    const existing = byBoardName.get(latest.boardName)
    if (!existing || info.strengthScore > existing.strengthScore) {
      byBoardName.set(latest.boardName, info)
    }
  }

  return {
    byBoardId,
    byBoardName,
    lookup({ boardId, boardName }) {
      if (boardId) {
        const hit = byBoardId.get(boardId)
        if (hit) return hit
      }
      if (boardName) {
        return byBoardName.get(boardName) ?? null
      }
      return null
    },
  }
}

/**
 * 阶段标签 / 颜色（前端复用）
 */
export const STAGE_LABELS: Record<RotationStage, string> = {
  STARTING: "启动",
  RISING: "主升",
  DIVERGING: "分歧",
  FADING: "退潮",
}

export const STAGE_EMOJI: Record<RotationStage, string> = {
  STARTING: "🟢",
  RISING: "🔥",
  DIVERGING: "⚠️",
  FADING: "🔻",
}

export const STAGE_COLORS: Record<RotationStage, string> = {
  STARTING: "green",
  RISING: "red",
  DIVERGING: "orange",
  FADING: "default",
}

/**
 * 阶段优先级（用于过滤"高优先级异动"：主升 > 启动 > 分歧 > 退潮）
 */
export const STAGE_PRIORITY: Record<RotationStage, number> = {
  RISING: 4,
  STARTING: 3,
  DIVERGING: 2,
  FADING: 1,
}
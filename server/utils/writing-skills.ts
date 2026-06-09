import type { EntityManager } from '@mikro-orm/core'
import { WritingSkillSchema } from '../database/entities'
import type { PromptWritingSkill } from './ai-prompts'

export interface SkillFewShot {
  scene: string
  content: string
}

/** 容错解析 JSON 数组字段，永不抛错（坏数据降级为空数组）。 */
export function parseJsonArray<T = unknown>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

/** 实体 → API/前端形态（JSON 字段解析为数组）。 */
export function serializeSkill(s: {
  id: number
  name: string
  description: string | null
  genre: string | null
  systemAddon: string | null
  fewShots: string | null
  checklist: string | null
  appliesTo: string | null
  isSystem: boolean | null
  enabled: boolean | null
  createdAt: Date
}) {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    genre: s.genre ?? null,
    systemAddon: s.systemAddon ?? null,
    fewShots: parseJsonArray<SkillFewShot>(s.fewShots),
    checklist: parseJsonArray<string>(s.checklist),
    appliesTo: parseJsonArray<string>(s.appliesTo),
    isSystem: s.isSystem === true,
    enabled: s.enabled !== false,
    createdAt: s.createdAt
  }
}

/** 解析 Novel.enabledSkillIds（JSON number[]）。 */
export function parseEnabledSkillIds(raw: string | null | undefined): number[] {
  return parseJsonArray<number>(raw).filter((n) => typeof n === 'number')
}

/**
 * 收集本次生成应注入的技能包，转为注入形态（PromptWritingSkill）。
 * - 仅取「系统包 或 属于该用户」的，避免越权读他人技能包。
 * - 按 appliesTo 过滤动作（空 appliesTo 视为全适用）。
 * - 同题材的排前面，few-shot 取用时优先同题材。
 * - 任何异常静默返回 []，绝不阻断生成（沿用本仓库「失败降级不中断」原则）。
 */
export async function loadSkillsForGeneration(
  em: EntityManager,
  opts: {
    userId: number
    ids: number[]
    action?: string
    genre?: string | null
  }
): Promise<PromptWritingSkill[]> {
  try {
    if (!opts.ids.length) return []
    const rows = await em.find(WritingSkillSchema, {
      id: { $in: opts.ids },
      $or: [{ user: opts.userId }, { isSystem: true }]
    })
    const action = opts.action || 'generation'
    const out: PromptWritingSkill[] = []
    for (const r of rows) {
      const appliesTo = parseJsonArray<string>(r.appliesTo)
      if (appliesTo.length && !appliesTo.includes(action)) continue
      out.push({
        name: r.name,
        systemAddon: r.systemAddon ?? '',
        fewShots: parseJsonArray<SkillFewShot>(r.fewShots),
        checklist: parseJsonArray<string>(r.checklist),
        genre: r.genre ?? null
      })
    }
    if (opts.genre) {
      out.sort(
        (a, b) =>
          Number(b.genre === opts.genre) - Number(a.genre === opts.genre)
      )
    }
    return out
  } catch {
    return []
  }
}

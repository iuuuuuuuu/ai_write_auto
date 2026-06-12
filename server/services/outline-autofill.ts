/**
 * 大纲读取兜底：生成正文「之前」读取已确认的本章大纲。
 *
 * 设计原则——先大纲、再正文：
 * 大纲是写作之前的「前瞻指引」（区别于写完后由 task-queue 提炼的 Chapter.summary 记忆），
 * 但不能在正文生成路径里隐式创建大纲；计划必须由章节工作流程显式生成并验收。
 *
 * - ensureChapterOutline：只读返回已存在的大纲；缺失时返回 undefined，不写库、不调用 AI。
 */
import type { EntityManager } from '@mikro-orm/core'
import type { ResolvedAiConfig } from '../utils/ai-configs'

export interface OutlineEntry {
  chapterNumber: number
  description: string
  sortOrder?: number
}

interface AutofillBase {
  em: EntityManager
  novel: {
    title: string
    genre?: string | null
    worldSetting?: string | null
    description?: string | null
  }
  novelId: number
  characters: Array<{ name: string; description?: string | null }>
  /** 已有大纲数组；新补条目会被原地 push 进来，供同批后续章节作为前序参考。 */
  existingOutlines: OutlineEntry[]
  direction?: string
  aiConfig: ResolvedAiConfig
  userId: number
}

/**
 * 单章只读兜底：若该章已有大纲直接返回；否则返回 undefined。
 */
export async function ensureChapterOutline(
  base: AutofillBase & { chapterNumber: number }
): Promise<{ description?: string; created: boolean }> {
  const { chapterNumber } = base
  const existing = base.existingOutlines.find(
    (o) => o.chapterNumber === chapterNumber
  )
  if (existing?.description)
    return { description: existing.description, created: false }
  return { description: undefined, created: false }
}

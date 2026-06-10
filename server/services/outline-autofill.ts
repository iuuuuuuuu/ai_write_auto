/**
 * 大纲自动补全：生成正文「之前」确保本章/本段有大纲可用。
 *
 * 设计原则——先大纲、再正文：
 * 大纲是写作之前的「前瞻指引」（区别于写完后由 task-queue 提炼的 Chapter.summary 记忆），
 * 因此补全必须发生在正文生成之前，并把大纲喂进正文 prompt。
 * 任何失败都静默降级（返回空），绝不阻断正文生成。
 *
 * - ensureChapterOutline：单章兜底（generate.post.ts 用）
 * - ensureOutlinesForRange：批量预规划，一次调用补齐整段缺口（workspace-generate.post.ts 用）
 */
import type { EntityManager } from '@mikro-orm/core'
import { streamAi, toAiOptions } from '../utils/ai-client'
import {
  recordUsage,
  estimateTokens,
  dynamicMaxTokens
} from '../utils/ai-stream'
import { parsePartialJsonArray } from '../utils/json-salvage'
import { buildOutlineGenerationPrompt } from '../utils/ai-prompts'
import { NovelOutlineSchema } from '../database/entities'
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

/** 容错解析 AI 返回的大纲 JSON 数组（贪婪 → 对象包装字段 → 截断 salvage），结构非法条目丢弃。 */
function parseOutlineArray(
  raw: string
): Array<{ chapterNumber: number; description: string }> {
  return parsePartialJsonArray(raw)
    .map((o) => {
      const item = (o && typeof o === 'object' ? o : {}) as Record<
        string,
        unknown
      >
      return {
        chapterNumber: Number(item.chapterNumber),
        description: String(item.description ?? '').trim()
      }
    })
    .filter(
      (o) =>
        Number.isFinite(o.chapterNumber) &&
        o.chapterNumber > 0 &&
        o.description.length > 0
    )
}

/** 调用 AI 生成 [startChapter, startChapter+chapterCount) 段的大纲并记账。 */
async function generateOutlineItems(
  base: AutofillBase,
  startChapter: number,
  chapterCount: number
): Promise<Array<{ chapterNumber: number; description: string }>> {
  const messages = buildOutlineGenerationPrompt({
    novel: base.novel,
    characters: base.characters,
    idea:
      base.direction ||
      base.novel.description ||
      `请为第 ${startChapter} 章起的剧情做出合理且连贯的推进规划`,
    chapterCount,
    startChapter,
    existingOutlines: base.existingOutlines.map((o) => ({
      chapterNumber: o.chapterNumber,
      description: o.description
    }))
  })

  let content = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(
    toAiOptions(base.aiConfig, {
      messages,
      temperature: 0.7,
      // 按段内章数动态给上限（每章大纲约 ~200 tokens），大段补全不被固定上限截断
      maxTokens: dynamicMaxTokens(chapterCount * 240 + 400, {
        floor: 1000,
        cap: 8000
      }),
      tracking: {
        userId: base.userId,
        configId: base.aiConfig.configId,
        modelId: base.aiConfig.modelId,
        purpose: 'generation',
        scenario: 'outline_autofill',
        source: 'service',
        novelId: base.novelId
      }
    })
  )) {
    if (chunk.content) content += chunk.content
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
  }
  if (!inputTokens && !outputTokens && content)
    outputTokens = estimateTokens(content)
  await recordUsage(
    {
      em: base.em,
      userId: base.userId,
      configId: base.aiConfig.id,
      model: base.aiConfig.model
    },
    inputTokens,
    outputTokens
  )
  return parseOutlineArray(content)
}

/** 落库一条大纲并同步进内存数组（sortOrder=chapterNumber，与 reorder 同步逻辑一致）。 */
function persistOutline(
  base: AutofillBase,
  chapterNumber: number,
  description: string
) {
  base.em.create(NovelOutlineSchema, {
    novel: base.novelId,
    chapterNumber,
    description,
    sortOrder: chapterNumber
  })
  base.existingOutlines.push({
    chapterNumber,
    description,
    sortOrder: chapterNumber
  })
}

/**
 * 单章兜底：若该章已有大纲直接返回；否则生成一条、落库、返回。失败降级返回 undefined。
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

  try {
    const items = await generateOutlineItems(base, chapterNumber, 1)
    const match =
      items.find((o) => o.chapterNumber === chapterNumber) || items[0]
    if (!match?.description) return { description: undefined, created: false }
    persistOutline(base, chapterNumber, match.description)
    await base.em.flush()
    return { description: match.description, created: true }
  } catch {
    return { description: undefined, created: false }
  }
}

/**
 * 批量预规划：补齐 [fromChapter, toChapter] 内缺失的大纲。
 * 一次 AI 调用生成整段，只落库缺失章号（不覆盖已有），返回被补的章号。失败降级返回空。
 */
export async function ensureOutlinesForRange(
  base: AutofillBase & { fromChapter: number; toChapter: number }
): Promise<{ filled: number[] }> {
  const { fromChapter, toChapter } = base
  const have = new Set(
    base.existingOutlines
      .filter((o) => o.description)
      .map((o) => o.chapterNumber)
  )
  const missing: number[] = []
  for (let n = fromChapter; n <= toChapter; n++) {
    if (!have.has(n)) missing.push(n)
  }
  if (missing.length === 0) return { filled: [] }

  try {
    const items = await generateOutlineItems(
      base,
      fromChapter,
      toChapter - fromChapter + 1
    )
    const byNumber = new Map(items.map((o) => [o.chapterNumber, o.description]))
    const filled: number[] = []
    for (const n of missing) {
      const desc = byNumber.get(n)
      if (desc) {
        persistOutline(base, n, desc)
        filled.push(n)
      }
    }
    if (filled.length > 0) await base.em.flush()
    return { filled }
  } catch {
    return { filled: [] }
  }
}

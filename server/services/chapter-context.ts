import type { EntityManager } from '@mikro-orm/core'
import { callAiWithUsage, toAiOptions } from '../utils/ai-client'
import {
  resolvePlanningConfig,
  isAgenticRetrievalEnabled
} from '../utils/ai-configs'
import {
  buildQueryPlanningPrompt,
  buildGenerationPrompt,
  type RagContextItem,
  type PromptNovel,
  type PromptChapter,
  type PromptCharacter,
  type PromptPlotPoint,
  type PromptStoryArc,
  type PromptForeshadowing,
  type PromptCharacterStateChange
} from '../utils/ai-prompts'
import {
  CharacterStateChangeSchema,
  type Chapter,
  type Character,
  type CharacterStateChange
} from '../database/entities'
import { loadSkillsForGeneration } from '../utils/writing-skills'
import { retrieveRelevant, type ContentContext } from './content-rag'
import { isEmbeddingReady } from './embedding'

export type RetrievalDepth = 'full' | 'query-only' | 'seed-only'

interface Usage {
  inputTokens: number
  outputTokens: number
}

export interface GatherOptions {
  novelId: number
  userId: number
  /** 本次操作意图，用于 query 规划，如「续写衔接」「扩写」「按反馈重写」「生成第3章」 */
  intent: string
  /** 种子/兜底文本（标题+大纲+方向 / 选中文本 / feedback 等）：query 规划失败或 seed-only 时直接当 query */
  seed: string
  depth: RetrievalDepth
  topK?: number
  contentType?: string | string[]
  // 轻量地板（供 query 规划，可选）
  novelInfo?: {
    title: string
    genre?: string | null
    description?: string | null
  }
  characterNames?: string[]
  foreshadowingTitles?: string[]
  recentSummaries?: string[]
  /** 额外要合并进结果的 notes（如批量的整批 sharedRagContext） */
  extraNotes?: RagContextItem[]
}

export interface GatherResult {
  retrievedNotes: RagContextItem[]
  queries?: string[]
  usage: Usage
}

const MAX_QUERIES = 5

function notesToItems(notes: ContentContext[]): RagContextItem[] {
  return notes.map((n) => ({
    content: n.content,
    contentType: n.contentType,
    chapterId: n.chapterId,
    characterName: n.characterName,
    score: n.score
  }))
}

/** 与 workspace-generate 的 mergeRagContexts 同构的去重键，保证合并行为一致 */
function dedupeNotes(items: RagContextItem[]): RagContextItem[] {
  const seen = new Set<string>()
  const out: RagContextItem[] = []
  for (const it of items) {
    const key = `${it.contentType}:${it.chapterId ?? 'novel'}:${it.characterName || ''}:${it.content}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

function parseQueryList(raw: string): string[] {
  try {
    const m = raw.match(/\[[\s\S]*\]/)
    const arr = JSON.parse(m?.[0] || raw)
    if (Array.isArray(arr)) {
      return arr
        .filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0
        )
        .map((x) => x.trim())
        .slice(0, MAX_QUERIES + 1)
    }
  } catch {
    /* 非法 JSON → 调用方回落 seed-only */
  }
  return []
}

/** query-only：用廉价模型（决策③）产出检索 query 列表。失败/无配置返回 []（调用方回落 seed）。 */
async function planQueries(
  em: EntityManager,
  opts: GatherOptions,
  usage: Usage
): Promise<string[]> {
  const cfg = await resolvePlanningConfig(em, opts.userId)
  if (!cfg) return []
  const messages = buildQueryPlanningPrompt({
    intent: opts.intent,
    seed: opts.seed,
    novel: opts.novelInfo,
    characterNames: opts.characterNames,
    foreshadowingTitles: opts.foreshadowingTitles,
    recentSummaries: opts.recentSummaries
  })
  const res = await callAiWithUsage(
    toAiOptions(cfg, {
      messages,
      temperature: 0.3,
      maxTokens: 256,
      // query 生成是廉价结构化调用：关掉思考链，省 token、降首 token 延迟（与标题生成一致）。
      // 不支持这些字段的供应商会忽略它们；真失败则上层回落 seed-only。
      extraBody: { enable_thinking: false, reasoning_effort: 'low' }
    })
  )
  usage.inputTokens += res.inputTokens
  usage.outputTokens += res.outputTokens
  return parseQueryList(res.content)
}

/**
 * 唯一的「按需检索」核心。6 个正文端点都调它。
 * 降级链：query-only →（规划失败/无配置/非法 JSON）→ seed-only → 不检索。
 * 任一环失败只影响检索质量，绝不抛错中断生成（调用方据此放心 await）。
 */
export async function gatherRelevantContext(
  em: EntityManager,
  opts: GatherOptions
): Promise<GatherResult> {
  const usage: Usage = { inputTokens: 0, outputTokens: 0 }
  const topK = opts.topK ?? 10
  const extra = opts.extraNotes || []

  // 无向量库：只能返回调用方给的 extraNotes
  if (!isEmbeddingReady()) {
    return { retrievedNotes: dedupeNotes(extra), usage }
  }

  // 总开关关 → 强制 seed-only；v1 没有工具循环，full 等价 query-only
  let depth = opts.depth
  if (!isAgenticRetrievalEnabled()) depth = 'seed-only'
  if (depth === 'full') depth = 'query-only'

  let queries: string[] | undefined
  if (depth === 'query-only') {
    try {
      const q = await planQueries(em, opts, usage)
      if (q.length) queries = q
    } catch {
      /* 规划失败 → 下面回落 seed */
    }
  }

  let notes: ContentContext[] = []
  try {
    if (queries && queries.length) {
      const groups = await Promise.all(
        queries
          .slice(0, MAX_QUERIES)
          .map((q) => retrieveRelevant(opts.novelId, q, topK, opts.contentType))
      )
      notes = groups.flat()
    } else if (opts.seed.trim()) {
      notes = await retrieveRelevant(
        opts.novelId,
        opts.seed,
        topK,
        opts.contentType
      )
    }
  } catch {
    notes = []
  }

  const merged = dedupeNotes([...notesToItems(notes), ...extra])
  return { retrievedNotes: merged, queries, usage }
}

export interface PrepareChapterOptions {
  novel: PromptNovel
  novelId: number
  userId: number
  currentChapter?: { title: string; chapterNumber: number }
  outline?: string
  direction?: string
  /** 已构建好的 PromptChapter[]（批量场景由调用方做 batchSummary 覆盖后传入，本函数不重新派生） */
  precedingChapters: PromptChapter[]
  characters: PromptCharacter[]
  plotPoints: PromptPlotPoint[]
  storyArcs?: PromptStoryArc[]
  foreshadowing?: PromptForeshadowing[]
  recentChapterContent?: Array<{
    chapterNumber: number
    title: string
    content: string
  }>
  depth: RetrievalDepth
  /** 批量的整批 sharedRagContext，合并进本章 notes */
  extraNotes?: RagContextItem[]
  /** 本次生成应注入的写作技能包 id（小说默认启用 + 本次勾选），加载失败静默跳过 */
  skillIds?: number[]
  contextSelection?: GenerationContextSelection
}

export interface PrepareChapterResult {
  messages: Array<{ role: 'system' | 'user'; content: string }>
  retrievedNotes: RagContextItem[]
  characterStateChanges: PromptCharacterStateChange[]
  queries?: string[]
  usage: Usage
}

export interface GenerationContextSelection {
  includedKeys?: string[]
  excludedKeys?: string[]
}

export interface SelectableGenerationContext {
  ragContext: RagContextItem[]
  characterStateChanges: Array<PromptCharacterStateChange & { id?: number }>
}

export function getRagContextKey(item: RagContextItem): string {
  return `rag:${item.contentType}:${item.chapterId ?? 'novel'}:${item.characterName || ''}`
}

export function getCharacterStateChangeKey(
  change: PromptCharacterStateChange & { id?: number }
): string {
  return `state-change:${change.id ?? `${change.chapterNumber}:${change.characterName}:${change.changeType}`}`
}

function shouldKeepContextItem(
  key: string,
  selection?: GenerationContextSelection
): boolean {
  if (!selection) return true
  const included = new Set(selection.includedKeys || [])
  const excluded = new Set(selection.excludedKeys || [])
  if (excluded.has(key)) return false
  return included.size === 0 || included.has(key)
}

export function applyGenerationContextSelection(
  context: SelectableGenerationContext,
  selection?: GenerationContextSelection
): SelectableGenerationContext {
  return {
    ragContext: context.ragContext.filter((item) =>
      shouldKeepContextItem(getRagContextKey(item), selection)
    ),
    characterStateChanges: context.characterStateChanges.filter((change) =>
      shouldKeepContextItem(getCharacterStateChangeKey(change), selection)
    )
  }
}

async function loadAcceptedCharacterStateChanges(
  em: EntityManager,
  opts: {
    novelId: number
    currentChapterNumber?: number
  }
) {
  const where: Record<string, unknown> = {
    novel: opts.novelId,
    status: 'accepted'
  }
  if (opts.currentChapterNumber) {
    where.chapter = {
      novel: opts.novelId,
      chapterNumber: { $lt: opts.currentChapterNumber },
      deletedAt: null
    }
  }

  const changes = await em.find(CharacterStateChangeSchema, where, {
    populate: ['chapter', 'character', 'relatedCharacter'],
    orderBy: { id: 'ASC' },
    limit: 80
  })

  return changes.map((change: CharacterStateChange) => {
    const chapter = change.chapter as Chapter
    const character = change.character as Character
    const relatedCharacter = change.relatedCharacter as Character | null
    return {
      id: change.id,
      chapterNumber: chapter.chapterNumber,
      characterName: character.name,
      relatedCharacterName: relatedCharacter?.name ?? null,
      changeType: change.changeType,
      afterValue: change.afterValue,
      evidenceQuote: change.evidenceQuote
    }
  })
}

/** 整章封装（仅单章/批量用）：调检索核心拿 notes，再走现有 buildGenerationPrompt 拼整章 messages。 */
export async function prepareChapterContext(
  em: EntityManager,
  opts: PrepareChapterOptions
): Promise<PrepareChapterResult> {
  const intent =
    opts.currentChapter ?
      `生成第${opts.currentChapter.chapterNumber}章${opts.currentChapter.title ? `「${opts.currentChapter.title}」` : ''}`
    : '生成下一章'
  const seed = [opts.currentChapter?.title, opts.outline, opts.direction]
    .filter(Boolean)
    .join(' ')

  const gathered = await gatherRelevantContext(em, {
    novelId: opts.novelId,
    userId: opts.userId,
    intent,
    seed,
    depth: opts.depth,
    topK: 10,
    novelInfo: {
      title: opts.novel.title,
      genre: opts.novel.genre,
      description: opts.novel.description
    },
    characterNames: opts.characters.map((c) => c.name),
    foreshadowingTitles: (opts.foreshadowing || []).map((f) => f.content),
    recentSummaries: opts.precedingChapters
      .filter((c) => c.summary)
      .slice(-8)
      .map((c) => `第${c.chapterNumber}章：${c.summary}`),
    extraNotes: opts.extraNotes
  })

  const skills = await loadSkillsForGeneration(em, {
    userId: opts.userId,
    ids: opts.skillIds || [],
    action: 'generation',
    genre: opts.novel.genre
  })

  const characterStateChanges = await loadAcceptedCharacterStateChanges(em, {
    novelId: opts.novelId,
    currentChapterNumber: opts.currentChapter?.chapterNumber
  })

  const selectedContext = applyGenerationContextSelection(
    {
      ragContext: gathered.retrievedNotes,
      characterStateChanges
    },
    opts.contextSelection
  )

  const messages = buildGenerationPrompt({
    novel: opts.novel,
    chapters: opts.precedingChapters,
    characters: opts.characters,
    plotPoints: opts.plotPoints,
    storyArcs: opts.storyArcs,
    currentChapter: opts.currentChapter,
    currentChapterOutline: opts.outline,
    userDirection: opts.direction,
    ragContext: selectedContext.ragContext,
    foreshadowing: opts.foreshadowing,
    recentChapterContent: opts.recentChapterContent,
    characterStateChanges: selectedContext.characterStateChanges,
    skills
  })

  return {
    messages,
    retrievedNotes: selectedContext.ragContext,
    characterStateChanges: selectedContext.characterStateChanges,
    queries: gathered.queries,
    usage: gathered.usage
  }
}

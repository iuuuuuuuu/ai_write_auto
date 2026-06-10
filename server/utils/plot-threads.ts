/**
 * 剧情线索 / 伏笔自动抽取（后处理）：从生成的章节正文里抽出长期记忆相关的线索，
 * 按签名 upsert 进 Foreshadowing / PlotPoint，避免 AI 自埋的伏笔在长篇里悬空、坑不填。
 *
 * 设计照搬 consistency-check：纯函数（parse/签名）便于单测 + 一个编排函数做模型调用与落库。
 * 全程对长期生成「只增不毁」且失败静默降级（解析失败返回 []，绝不影响正文）。
 */
import type { EntityManager } from '@mikro-orm/core'
import { createHash } from 'node:crypto'
import { streamAi, toAiOptions } from './ai-client'
import { normalizeText } from './consistency-check'
import { buildPlotThreadExtractionPrompt } from './ai-prompts'
import {
  AiConfigSchema,
  ChapterSchema,
  ForeshadowingSchema,
  PlotPointSchema
} from '../database/entities'
import { indexForeshadowing, indexPlotEvent } from '../services/content-rag'
import { filterUsablePlotPoints } from './plot-points'
import { isActiveChapterRef } from './chapter-refs'

export type ThreadKind =
  | 'foreshadow_setup'
  | 'foreshadow_payoff'
  | 'plot_open'
  | 'plot_advance'
  | 'plot_resolve'

const THREAD_KINDS: ThreadKind[] = [
  'foreshadow_setup',
  'foreshadow_payoff',
  'plot_open',
  'plot_advance',
  'plot_resolve'
]

export interface ParsedThread {
  kind: ThreadKind
  summary: string
  groundQuote: string
  relatedTo: string | null
}

/** 线索类目（伏笔 / 剧情）；签名据此分桶，避免不同类目误判同义。 */
function categoryOf(kind: ThreadKind): 'foreshadow' | 'plot' {
  return kind.startsWith('foreshadow') ? 'foreshadow' : 'plot'
}

/** 去重签名：基于类目 + 归一化 summary（措辞稳定），跨次抽取同一条线索不重复入库。 */
export function plotThreadSignature(kind: ThreadKind, summary: string): string {
  const basis = `${categoryOf(kind)}|${normalizeText(summary)}`
  return createHash('sha1').update(basis).digest('hex').slice(0, 32)
}

/** 容错解析 AI 返回的线索 JSON 数组（贪婪匹配 → 截断 salvage），结构非法的条目丢弃。纯函数，便于单测。 */
export function parsePlotThreads(raw: string): ParsedThread[] {
  const cleaned = raw
    .replace(/^```(?:json|JSON)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()

  let parsed: unknown = null
  const m = cleaned.match(/\[[\s\S]*\]/)
  const candidate = m?.[0] ?? cleaned
  try {
    parsed = JSON.parse(candidate)
  } catch {
    // 截断 salvage：截到最后一个完整对象，补齐括号再解析
    const lastClose = cleaned.lastIndexOf('}')
    const open = cleaned.indexOf('[')
    if (lastClose > 0 && open >= 0 && open < lastClose) {
      let fix = cleaned.slice(open, lastClose + 1)
      if (fix.split('"').length % 2 === 0) fix += '"'
      const opens = (fix.match(/\{/g) || []).length
      const closes = (fix.match(/\}/g) || []).length
      for (let i = 0; i < opens - closes; i++) fix += '}'
      fix += ']'
      try {
        parsed = JSON.parse(fix)
      } catch {
        /* 仍失败 → 返回空 */
      }
    }
  }
  if (!Array.isArray(parsed)) return []

  const out: ParsedThread[] = []
  for (const item of parsed as Array<Record<string, unknown>>) {
    if (!item || typeof item !== 'object') continue
    const kind = item.kind as ThreadKind
    if (!THREAD_KINDS.includes(kind)) continue
    const summary = typeof item.summary === 'string' ? item.summary.trim() : ''
    const groundQuote =
      typeof item.groundQuote === 'string' ? item.groundQuote.trim() : ''
    if (!summary || !groundQuote) continue
    const relatedTo =
      typeof item.relatedTo === 'string' && item.relatedTo.trim() ?
        item.relatedTo.trim()
      : null
    out.push({ kind, summary, groundQuote, relatedTo })
  }
  return out
}

/** 按 relatedTo 在活跃项里做归一化双向子串匹配，找回收/推进的目标。找不到返回 undefined。 */
function matchActive<T>(
  items: T[],
  relatedTo: string | null,
  getText: (t: T) => string
): T | undefined {
  if (!relatedTo) return undefined
  const rt = normalizeText(relatedTo)
  if (rt.length < 3) return undefined
  return items.find((it) => {
    const n = normalizeText(getText(it))
    return n.length >= 3 && (n.includes(rt) || rt.includes(n))
  })
}

export interface PlotThreadResult {
  created: number
  resolved: number
  inputTokens: number
  outputTokens: number
}

const ZERO: PlotThreadResult = {
  created: 0,
  resolved: 0,
  inputTokens: 0,
  outputTokens: 0
}

/**
 * 编排：抽取本章线索 → 按签名去重 upsert（新建伏笔/线索、回收已有项）→ 索引入向量库。
 * 用廉价 extraction 配置；无配置/无内容时返回零。解析失败只产出空结果，不抛错。
 */
export async function runPlotThreadExtraction(
  em: EntityManager,
  userId: number,
  novelId: number,
  chapterId: number
): Promise<PlotThreadResult> {
  const config =
    (await em.findOne(
      AiConfigSchema,
      { user: userId, purpose: 'extraction', enabled: true, isDefault: true },
      { populate: ['aiModel', 'aiModel.provider'] }
    )) ||
    (await em.findOne(
      AiConfigSchema,
      { user: userId, purpose: 'extraction', enabled: true },
      { populate: ['aiModel', 'aiModel.provider'] }
    ))
  if (!config || !config.aiModel) return ZERO
  const aiModel = config.aiModel as any
  if (!aiModel.enabled) return ZERO
  const provider = aiModel.provider
  if (!provider?.enabled) return ZERO
  const aiConfig = {
    apiUrl: provider.apiUrl,
    apiKey: provider.apiKey,
    model: aiModel.model,
    modelId: aiModel.id,
    configId: config.id
  }

  const chapter = await em.findOne(
    ChapterSchema,
    { id: chapterId, novel: novelId, deletedAt: null },
    { populate: ['content'] }
  )
  if (!chapter || !chapter.content) return ZERO

  const allActiveFs = await em.find(
    ForeshadowingSchema,
    { novel: novelId, status: 'active' },
    { populate: ['chapter'] }
  )
  const activeFs = allActiveFs.filter((foreshadowing) =>
    isActiveChapterRef(foreshadowing.chapter)
  )
  const allActivePp = await em.find(
    PlotPointSchema,
    { novel: novelId, status: { $ne: 'resolved' } },
    { populate: ['chapter'] }
  )
  const activePp = filterUsablePlotPoints(allActivePp)

  const messages = buildPlotThreadExtractionPrompt({
    chapterNumber: chapter.chapterNumber,
    chapterContent: chapter.content,
    activeForeshadowing: activeFs.map((f) => ({ content: f.content })),
    activePlotPoints: activePp.map((p) => ({ description: p.description }))
  })

  let result = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.2,
      maxTokens: 1500,
      tracking: {
        userId,
        configId: config.id,
        modelId: aiModel.id,
        purpose: 'extraction',
        scenario: 'plot_thread_extract',
        source: 'service',
        novelId,
        chapterId
      }
    })
  )) {
    if (chunk.content) result += chunk.content
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
  }

  const threads = parsePlotThreads(result)
  const targetNorm = normalizeText(chapter.content)

  // 已有活跃项的签名集合，用于去重「新建」
  const seenFsSig = new Set(
    activeFs.map((f) => plotThreadSignature('foreshadow_setup', f.content))
  )
  const seenPpSig = new Set(
    activePp.map((p) => plotThreadSignature('plot_open', p.description))
  )

  let created = 0
  let resolved = 0
  const toIndex: Array<{
    kind: 'foreshadow' | 'plot'
    entity: { id: number }
    text: string
  }> = []

  for (const t of threads) {
    // grounding：groundQuote 必须出现在本章真实原文（归一化子串）
    const gq = normalizeText(t.groundQuote)
    if (gq.length < 3 || !targetNorm.includes(gq)) continue
    const sig = plotThreadSignature(t.kind, t.summary)

    if (t.kind === 'foreshadow_setup') {
      if (seenFsSig.has(sig)) continue
      seenFsSig.add(sig)
      const fs = em.create(ForeshadowingSchema, {
        novel: novelId,
        chapter: chapterId,
        content: t.summary,
        description: t.groundQuote,
        status: 'active'
      })
      created++
      toIndex.push({ kind: 'foreshadow', entity: fs, text: t.summary })
    } else if (t.kind === 'foreshadow_payoff') {
      const match = matchActive(activeFs, t.relatedTo, (f) => f.content)
      if (match && match.status === 'active') {
        match.status = 'resolved'
        match.resolvedAtChapter = chapter.chapterNumber
        resolved++
      }
    } else if (t.kind === 'plot_open') {
      if (seenPpSig.has(sig)) continue
      seenPpSig.add(sig)
      const pp = em.create(PlotPointSchema, {
        novel: novelId,
        chapter: chapterId,
        description: t.summary,
        type: 'setup',
        status: 'introduced'
      })
      created++
      toIndex.push({ kind: 'plot', entity: pp, text: t.summary })
    } else if (t.kind === 'plot_resolve') {
      const match = matchActive(activePp, t.relatedTo, (p) => p.description)
      if (match && match.status !== 'resolved') {
        match.status = 'resolved'
        resolved++
      }
    } else if (t.kind === 'plot_advance') {
      // 推进：命中已有线索则不动（已在活跃集），未命中则当作新开线索补录
      const match = matchActive(activePp, t.relatedTo, (p) => p.description)
      if (!match && !seenPpSig.has(sig)) {
        seenPpSig.add(sig)
        const pp = em.create(PlotPointSchema, {
          novel: novelId,
          chapter: chapterId,
          description: t.summary,
          type: 'setup',
          status: 'introduced'
        })
        created++
        toIndex.push({ kind: 'plot', entity: pp, text: t.summary })
      }
    }
  }

  await em.flush()

  // flush 后实体已有 id，索引入向量库（索引函数内部自带 embedding 就绪判断，失败不抛）
  for (const it of toIndex) {
    if (it.kind === 'foreshadow') {
      await indexForeshadowing(it.entity.id, novelId, chapterId, it.text).catch(
        () => {}
      )
    } else {
      await indexPlotEvent(it.entity.id, novelId, chapterId, it.text).catch(
        () => {}
      )
    }
  }

  return { created, resolved, inputTokens, outputTokens }
}

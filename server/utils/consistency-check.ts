import type { EntityManager } from '@mikro-orm/core'
import { createHash } from 'node:crypto'
import { streamAi, toAiOptions } from './ai-client'
import { buildConsistencyCheckPrompt } from './ai-prompts'
import { AiConfigSchema, ChapterSchema, CharacterSchema, ConsistencyIssueSchema } from '../database/entities'
import { retrieveRelevant } from '../services/content-rag'

interface ParsedIssue {
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  quote: string
  priorQuote: string
  priorChapter: number | null
  confidence: number
}

const MIN_CONFIDENCE = 0.5

function normalizeText(s: string): string {
  return (s || '')
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：""''「」『』（）(),.!?;:~—\-…·]/g, '')
    .toLowerCase()
}

/** 签名基于 grounded quote（type + 归一化本章引用 + 早先章节号），比自由文本 description 稳定，用于跨次去重 / 保留 dismissed。 */
function issueSignature(issue: ParsedIssue): string {
  const basis = `${normalizeText(issue.type)}|${normalizeText(issue.quote)}|${issue.priorChapter ?? ''}`
  return createHash('sha1').update(basis).digest('hex').slice(0, 32)
}

export async function runConsistencyCheck(
  em: EntityManager,
  userId: number,
  novelId: number,
  chapterId: number
): Promise<Array<{ type: string; severity: string; description: string }>> {
  const config = await em.findOne(AiConfigSchema, { user: userId, purpose: 'consistency_check', enabled: true, isDefault: true }, { populate: ['aiModel', 'aiModel.provider'] })
    || await em.findOne(AiConfigSchema, { user: userId, purpose: 'consistency_check', enabled: true }, { populate: ['aiModel', 'aiModel.provider'] })
    || await em.findOne(AiConfigSchema, { user: userId, purpose: 'extraction', enabled: true }, { populate: ['aiModel', 'aiModel.provider'] })
  if (!config || !config.aiModel) return []
  const aiModel = config.aiModel as any
  if (!aiModel.enabled) return []
  const provider = aiModel.provider
  if (!provider?.enabled) return []
  const aiConfig = { apiUrl: provider.apiUrl, apiKey: provider.apiKey, model: aiModel.model, modelId: aiModel.id }

  const targetChapter = await em.findOne(ChapterSchema, {
    id: chapterId,
    novel: novelId,
    deletedAt: null,
  }, { populate: ['content'] })
  if (!targetChapter || !targetChapter.content) return []

  const characters = await em.find(CharacterSchema, { novel: novelId })

  const precedingChapters = await em.find(ChapterSchema, {
    novel: novelId,
    deletedAt: null,
    chapterNumber: { $lt: targetChapter.chapterNumber },
    summary: { $ne: null },
  }, { orderBy: { chapterNumber: 'DESC' }, limit: 5 })

  const recentSummaries = precedingChapters
    .slice()
    .reverse()
    .map((c) => ({ chapterNumber: c.chapterNumber, summary: c.summary! }))

  // 校验前捞「真实早先段落」喂入：用本章实体（角色名 + 开头正文）做检索 query，
  // 过滤掉本章自身的向量项，给模型真实可引用的 priorQuote 来源（替代只看 5 章摘要）。
  // 无 embedding 时降级为空，仍可用「前情摘要」作 priorQuote 来源。
  let priorPassages: Array<{ chapterNumber: number | null; label: string; content: string }> = []
  try {
    const seed = [characters.map((c) => c.name).join(' '), targetChapter.content.slice(0, 500)]
      .filter(Boolean)
      .join(' ')
    const retrieved = await retrieveRelevant(novelId, seed, 8)
    const filtered = retrieved.filter((r) => r.chapterId !== targetChapter.id)
    if (filtered.length) {
      const chapterIds = [...new Set(filtered.map((r) => r.chapterId).filter((id): id is number => typeof id === 'number'))]
      const chapterRows = chapterIds.length
        ? await em.find(ChapterSchema, { id: { $in: chapterIds } })
        : []
      const numberById = new Map(chapterRows.map((c) => [c.id, c.chapterNumber]))
      priorPassages = filtered.map((r) => ({
        chapterNumber: r.chapterId != null ? numberById.get(r.chapterId) ?? null : null,
        label: r.characterName || r.contentType,
        content: r.content
      }))
    }
  } catch {}

  const messages = buildConsistencyCheckPrompt({
    characters,
    recentSummaries,
    priorPassages,
    targetChapter: { chapterNumber: targetChapter.chapterNumber, content: targetChapter.content }
  })

  let result = ''
  for await (const chunk of streamAi(toAiOptions(aiConfig, {
    messages,
    temperature: 0.2,
    maxTokens: 2000,
  }))) {
    if (chunk.content) result += chunk.content
  }

  // 强制举证校验：quote 必须能在本章真实原文里对上，priorQuote 必须能在早先原文/前情里对上，
  // confidence 过低或缺引用一律丢弃（降误报核心）。
  const targetNorm = normalizeText(targetChapter.content)
  const priorNorm = normalizeText(
    [...priorPassages.map((p) => p.content), ...recentSummaries.map((s) => s.summary)].join(' ')
  )

  let parsed: unknown
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    parsed = JSON.parse(jsonMatch?.[0] || result)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const validated: ParsedIssue[] = []
  for (const raw of parsed as any[]) {
    if (!raw || typeof raw !== 'object') continue
    const quote = typeof raw.quote === 'string' ? raw.quote.trim() : ''
    const priorQuote = typeof raw.priorQuote === 'string' ? raw.priorQuote.trim() : ''
    if (!quote || !priorQuote) continue
    // confidence 是次级过滤：缺省/非法时按通过处理（0.6），只有「明确给出且 < 0.5」才丢弃；
    // 主过滤是下面的 grounding（引用必须能在真实原文里对上）。
    const rawConf = typeof raw.confidence === 'number' ? raw.confidence : parseFloat(raw.confidence)
    const confidence = Number.isFinite(rawConf) ? rawConf : 0.6
    if (confidence < MIN_CONFIDENCE) continue
    const qn = normalizeText(quote)
    const pqn = normalizeText(priorQuote)
    if (qn.length < 4 || pqn.length < 4) continue
    if (!targetNorm.includes(qn)) continue
    if (priorNorm && !priorNorm.includes(pqn)) continue
    const priorChapter = typeof raw.priorChapter === 'number' && Number.isFinite(raw.priorChapter)
      ? raw.priorChapter
      : (parseInt(raw.priorChapter, 10) || null)
    validated.push({
      type: typeof raw.type === 'string' && raw.type ? raw.type : 'unknown',
      severity: ['high', 'medium', 'low'].includes(raw.severity) ? raw.severity : 'medium',
      description: typeof raw.description === 'string' ? raw.description : '',
      quote,
      priorQuote,
      priorChapter,
      confidence
    })
  }

  // 按签名 upsert：命中已有行则刷新内容但保留 dismissed；本轮未再出现的非 dismissed 行剪枝；
  // dismissed 行始终保留作墓碑，使被忽略的问题即便重测也不再冒出。
  const existing = await em.find(ConsistencyIssueSchema, { chapter: chapterId })
  const existingBySig = new Map<string, (typeof existing)[number]>()
  for (const row of existing) {
    if (row.signature) existingBySig.set(row.signature, row)
  }

  const seenSigs = new Set<string>()
  for (const issue of validated) {
    const sig = issueSignature(issue)
    if (seenSigs.has(sig)) continue
    seenSigs.add(sig)
    const match = existingBySig.get(sig)
    if (match) {
      match.type = issue.type
      match.severity = issue.severity
      match.description = issue.description
      match.quote = issue.quote
      match.priorQuote = issue.priorQuote
      match.priorChapter = issue.priorChapter
      match.confidence = String(issue.confidence)
    } else {
      em.create(ConsistencyIssueSchema, {
        chapter: chapterId,
        type: issue.type,
        severity: issue.severity,
        description: issue.description,
        quote: issue.quote,
        priorQuote: issue.priorQuote,
        priorChapter: issue.priorChapter,
        confidence: String(issue.confidence),
        signature: sig
      })
    }
  }

  for (const row of existing) {
    if (row.dismissed) continue
    if (!row.signature || !seenSigs.has(row.signature)) {
      em.remove(row)
    }
  }

  await em.flush()

  return validated.map((i) => ({ type: i.type, severity: i.severity, description: i.description }))
}

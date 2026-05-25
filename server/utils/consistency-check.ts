import type { EntityManager } from '@mikro-orm/core'
import { callAi } from './ai-client'
import { buildConsistencyCheckPrompt } from './ai-prompts'
import { AiConfigSchema, ChapterSchema, CharacterSchema, ConsistencyIssueSchema } from '../database/entities'

export async function runConsistencyCheck(
  em: EntityManager,
  userId: number,
  novelId: number,
  chapterId: number
): Promise<Array<{ type: string; severity: string; description: string }>> {
  const config = await em.findOne(AiConfigSchema, { user: userId, purpose: 'consistency_check', enabled: true, isDefault: true }, { populate: ['aiModel'] })
    || await em.findOne(AiConfigSchema, { user: userId, purpose: 'consistency_check', enabled: true }, { populate: ['aiModel'] })
    || await em.findOne(AiConfigSchema, { user: userId, purpose: 'extraction', enabled: true }, { populate: ['aiModel'] })
  if (!config || !config.aiModel) return []
  const aiModel = config.aiModel as any
  if (!aiModel.enabled) return []
  const aiConfig = { apiUrl: aiModel.apiUrl, apiKey: aiModel.apiKey, model: aiModel.model }

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
    .reverse()
    .map((c) => ({ chapterNumber: c.chapterNumber, summary: c.summary! }))

  const messages = buildConsistencyCheckPrompt({
    characters,
    recentSummaries,
    targetChapter: { chapterNumber: targetChapter.chapterNumber, content: targetChapter.content }
  })

  const result = await callAi({
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.2,
    maxTokens: 2000,
  })

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    const issues: Array<{ type: string; severity: string; description: string }> = JSON.parse(jsonMatch?.[0] || result)

    if (Array.isArray(issues) && issues.length > 0) {
      await em.nativeDelete(ConsistencyIssueSchema, { chapter: chapterId })

      for (const issue of issues) {
        em.create(ConsistencyIssueSchema, {
          chapter: chapterId,
          type: issue.type || 'unknown',
          severity: (issue.severity as any) || 'medium',
          description: issue.description || ''
        })
      }
      await em.flush()
    }

    return issues
  } catch {
    return []
  }
}

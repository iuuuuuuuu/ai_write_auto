import { z } from 'zod'
import { callAiWithUsage } from '../../utils/ai-client'
import { recordUsage } from '../../utils/ai-stream'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { buildConsistencyCheckPrompt } from '../../utils/ai-prompts'
import { ChapterSchema, CharacterSchema } from '../../database/entities'

const checkSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  aiConfigId: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = checkSchema.parse(body)
  const em = useEm(event)

  const resolved = await resolveUserAiConfig(em, auth.userId, 'consistency_check', data.aiConfigId)

  const chapters = await em.find(ChapterSchema, {
    novel: { id: data.novelId, user: auth.userId },
    deletedAt: null,
  }, { orderBy: { chapterNumber: 'ASC' } })

  const targetChapter = chapters.find((c) => c.id === data.chapterId)
  if (!targetChapter) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }

  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const recentSummaries = chapters
    .filter((c) => c.chapterNumber < targetChapter.chapterNumber && c.summary)
    .slice(-5)
    .map((c) => ({ chapterNumber: c.chapterNumber, summary: c.summary! }))

  const messages = buildConsistencyCheckPrompt({
    characters,
    recentSummaries,
    targetChapter: { chapterNumber: targetChapter.chapterNumber, content: targetChapter.content || '' }
  })

  const { content: result, inputTokens, outputTokens } = await callAiWithUsage({
    apiUrl: resolved.apiUrl,
    apiKey: resolved.apiKey,
    model: resolved.model,
    messages,
    temperature: 0.2,
    maxTokens: 2000,
  })

  await recordUsage({ em, userId: auth.userId, configId: resolved.id, model: resolved.model }, inputTokens, outputTokens)

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    const issues = JSON.parse(jsonMatch?.[0] || result)
    return { issues }
  } catch {
    return { issues: [], raw: result }
  }
})

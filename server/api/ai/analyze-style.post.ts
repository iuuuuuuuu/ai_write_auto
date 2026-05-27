import { z } from 'zod'
import { callAiWithUsage, toAiOptions } from '../../utils/ai-client'
import { recordUsage } from '../../utils/ai-stream'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { buildStyleAnalysisPrompt } from '../../utils/ai-prompts'
import { NovelSchema, ChapterSchema } from '../../database/entities'

const styleSchema = z.object({
  novelId: z.number().int().positive(),
  aiConfigId: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = styleSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveUserAiConfig(em, auth.userId, 'style_analysis', data.aiConfigId)

  const chapters = await em.find(ChapterSchema, {
    novel: data.novelId,
    deletedAt: null,
  }, { orderBy: { chapterNumber: 'ASC' }, limit: 5, populate: ['content'] })

  const sampleText = chapters
    .filter((c) => c.content)
    .map((c) => c.content!.slice(0, 1500))
    .join('\n\n---\n\n')

  if (!sampleText) {
    throw createError({ statusCode: 400, message: 'No chapter content to analyze' })
  }

  const messages = buildStyleAnalysisPrompt(sampleText)

  const { content: styleGuide, inputTokens, outputTokens } = await callAiWithUsage(toAiOptions(aiConfig, {
    messages,
    temperature: 0.3,
    maxTokens: 1000,
  }))

  await recordUsage({ em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }, inputTokens, outputTokens)

  await em.nativeUpdate(NovelSchema, { id: data.novelId }, { styleGuide, updatedAt: new Date() })

  return { styleGuide }
})

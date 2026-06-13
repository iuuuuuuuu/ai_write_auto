import { z } from 'zod'
import {
  createStreamResponse,
  dynamicMaxTokens,
  prepareBudgetedAiOptions,
  standardAiBudgetOptions
} from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildOutlineGenerationPrompt } from '../../utils/ai-prompts'
import { NovelSchema, CharacterSchema } from '../../database/entities'

const outlineGenSchema = z.object({
  novelId: z.number().int().positive(),
  idea: z.string().min(1),
  chapterCount: z.number().int().min(3).max(200).default(20),
  startChapter: z.number().int().min(1).optional(),
  existingOutlines: z
    .array(
      z.object({
        chapterNumber: z.number().int().positive(),
        description: z.string()
      })
    )
    .optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = outlineGenSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const startChapter = data.startChapter || 1
  const messages = buildOutlineGenerationPrompt({
    novel,
    characters,
    idea: data.idea,
    chapterCount: data.chapterCount,
    startChapter,
    existingOutlines: data.existingOutlines
  })
  const desiredOutputTokens = dynamicMaxTokens(data.chapterCount * 120 + 300, {
    floor: 1000,
    cap: 8000
  })
  const budgeted = prepareBudgetedAiOptions(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.5,
      thinkingEnabled: false,
      maxTokens: desiredOutputTokens,
      tracking: {
        userId: auth.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'generation',
        scenario: 'outline_generate',
        source: 'api_route',
        endpoint: '/api/ai/generate-outline',
        novelId: data.novelId
      }
    }),
    standardAiBudgetOptions(aiConfig.contextWindowTokens, desiredOutputTokens)
  )

  return createStreamResponse(
    event,
    budgeted.options,
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model },
    { parseJsonResult: true }
  )
})

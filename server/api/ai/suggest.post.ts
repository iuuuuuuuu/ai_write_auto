import { z } from 'zod'
import { createStreamResponse } from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { MAX_TOKENS_SUGGEST } from '../../utils/ai-constants'
import { buildSuggestionPrompt } from '../../utils/ai-prompts'
import {
  NovelSchema,
  ChapterSchema,
  CharacterSchema
} from '../../database/entities'

const suggestSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = suggestSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const chapter = await em.findOne(
    ChapterSchema,
    { id: data.chapterId, novel: data.novelId },
    { populate: ['content'] }
  )
  if (!chapter || !chapter.content) {
    throw createError({
      statusCode: 400,
      message: 'Chapter has no content to review'
    })
  }

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const messages = buildSuggestionPrompt({
    novel,
    chapter: {
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      content: chapter.content
    },
    characters: characters.slice(0, 10)
  })

  return createStreamResponse(
    event,
    {
      ...toAiOptions(aiConfig, {
        messages,
        temperature: 0.4,
        maxTokens: MAX_TOKENS_SUGGEST,
        tracking: {
          userId: auth.userId,
          configId: aiConfig.configId,
          modelId: aiConfig.modelId,
          purpose: 'generation',
          scenario: 'chapter_suggest',
          source: 'api_route',
          endpoint: '/api/ai/suggest',
          novelId: data.novelId,
          chapterId: data.chapterId
        }
      })
    },
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model },
    { parseJsonResult: true }
  )
})

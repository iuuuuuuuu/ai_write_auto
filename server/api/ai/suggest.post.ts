import { z } from 'zod'
import { createStreamResponse } from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildSuggestionPrompt } from '../../utils/ai-prompts'
import { NovelSchema, ChapterSchema, CharacterSchema } from '../../database/entities'

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

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const chapter = await em.findOne(ChapterSchema, { id: data.chapterId, novel: data.novelId })
  if (!chapter || !chapter.content) {
    throw createError({ statusCode: 400, message: 'Chapter has no content to review' })
  }

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'consistency_check', data.aiConfigId)
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const messages = buildSuggestionPrompt({
    novel,
    chapter: { chapterNumber: chapter.chapterNumber, title: chapter.title, content: chapter.content },
    characters: characters.slice(0, 10)
  })

  return createStreamResponse(event, {
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.4,
    maxTokens: 4000
  }, { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }, { parseJsonResult: true })
})

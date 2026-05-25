import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { MAX_TOKENS_ACTION, CONTEXT_TRUNCATE_CHAPTER } from '../../utils/ai-constants'
import { ChapterSchema, NovelSchema, CharacterSchema } from '../../database/entities'

const continueSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  contextBefore: z.string(),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = continueSchema.parse(body)
  const em = useEm(event)

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }
  const chapter = await em.findOne(ChapterSchema, {
    id: data.chapterId,
    novel: { user: auth.userId },
    deletedAt: null,
  })
  if (!chapter) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const characterContext = characters.length > 0
    ? `\n角色：${characters.slice(0, 8).map(c => `${c.name}${c.traits ? `(${c.traits})` : ''}`).join('、')}`
    : ''

  const messages = [
    {
      role: 'system' as const,
      content:
        `你是一位专业的小说作家。请根据上下文，在光标位置之后继续创作小说内容。保持原有的风格、语气和叙事节奏，确保情节连贯自然。只返回续写的内容，不要其他说明。${novel.styleGuide ? `\n\n## 风格指南\n${novel.styleGuide}` : ''}`
    },
    {
      role: 'user' as const,
      content: `小说：${novel.title}${novel.genre ? `（${novel.genre}）` : ''}\n章节：第${chapter.chapterNumber}章「${chapter.title}」${characterContext}\n\n光标前的内容（需从此处续写）：\n${data.contextBefore.slice(-CONTEXT_TRUNCATE_CHAPTER)}${data.direction ? `\n\n续写方向：${data.direction}` : ''}`
    }
  ]

  return createInlineStreamResponse(event, {
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: parseFloat(aiConfig.temperature || '0.7'),
    maxTokens: MAX_TOKENS_ACTION,
  }, { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model })
})

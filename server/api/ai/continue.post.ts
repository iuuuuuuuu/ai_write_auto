import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { MAX_TOKENS_ACTION, CONTEXT_TRUNCATE_CHAPTER } from '../../utils/ai-constants'
import { ChapterSchema, NovelSchema, CharacterSchema } from '../../database/entities'
import { isEmbeddingReady } from '../../services/embedding'
import { retrieveRelevant, getActiveForeshadowing } from '../../services/content-rag'

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

  
  // RAG: retrieve relevant context for continuity
  let ragContextSection = ''
  if (isEmbeddingReady()) {
    const query = [chapter.title, data.contextBefore.slice(-200), data.direction].filter(Boolean).join(' ')
    if (query) {
      const ragResults = await retrieveRelevant(data.novelId, query, 8)
      if (ragResults.length) {
        ragContextSection = '\n## 相关上下文（基于续写位置检索）\n'
        for (const item of ragResults) {
          const label = item.characterName || `[${item.contentType}]`
          ragContextSection += `- ${label}：${item.content}\n`
        }
      }
    }
  }

  // Active foreshadowing
  let foreshadowSection = ''
  try {
    const foreshadowing = await getActiveForeshadowing(data.novelId)
    if (foreshadowing.length) {
      foreshadowSection = '\n## 当前活跃伏笔\n'
      for (const f of foreshadowing.slice(0, 5)) foreshadowSection += `- ${f.content}\n`
    }
  } catch {}

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
      content: `小说：${novel.title}${characterContext}${ragContextSection}${foreshadowSection}\n\n光标前的内容${novel.genre ? `（${novel.genre}）` : ''}\n章节：第${chapter.chapterNumber}章「${chapter.title}」${characterContext}\n\n光标前的内容（需从此处续写）：\n${data.contextBefore.slice(-CONTEXT_TRUNCATE_CHAPTER)}${data.direction ? `\n\n续写方向：${data.direction}` : ''}`
    }
  ]

  return createInlineStreamResponse(event, {
    ...toAiOptions(aiConfig, {
      messages,
      temperature: parseFloat(aiConfig.temperature || '0.7'),
      maxTokens: MAX_TOKENS_ACTION,
    }),
  }, { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model })
})

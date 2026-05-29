import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { MAX_TOKENS_ACTION, CONTEXT_TRUNCATE_INLINE } from '../../utils/ai-constants'
import { ChapterSchema, NovelSchema, CharacterSchema } from '../../database/entities'
import { isEmbeddingReady } from '../../services/embedding'
import { retrieveRelevant } from '../../services/content-rag'

const rewriteSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  selectedText: z.string().min(1),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = rewriteSchema.parse(body)
  const em = useEm(event)

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: '小说不存在' })
  const chapter = await em.findOne(ChapterSchema, {
    id: data.chapterId,
    novel: { user: auth.userId },
    deletedAt: null,
  }, { populate: ['content'] })
  if (!chapter) throw createError({ statusCode: 404, message: '章节不存在' })
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  
  // RAG: retrieve relevant context for rewriting
  let ragContextSection = ''
  if (isEmbeddingReady()) {
    const query = data.selectedText.slice(0, 200)
    if (query) {
      const ragResults = await retrieveRelevant(data.novelId, query, 6)
      if (ragResults.length) {
        ragContextSection = '\n## 相关上下文\n'
        for (const item of ragResults) {
          const label = item.characterName || `[${item.contentType}]`
          ragContextSection += `- ${label}：${item.content}\n`
        }
      }
    }
  }

  const chapterContent = chapter?.content || ''
  const characterContext = characters.length > 0
    ? `\n角色：${characters.slice(0, 8).map(c => `${c.name}${c.traits ? `(${c.traits})` : ''}`).join('、')}`
    : ''

  // Extract context around the selection, not from the beginning
  const selIdx = chapterContent.indexOf(data.selectedText)
  let contextWindow = ''
  if (selIdx >= 0) {
    const before = chapterContent.slice(Math.max(0, selIdx - CONTEXT_TRUNCATE_INLINE), selIdx)
    const after = chapterContent.slice(selIdx + data.selectedText.length, selIdx + data.selectedText.length + CONTEXT_TRUNCATE_INLINE)
    contextWindow = `...${before}【选中部分：${data.selectedText}】${after}...`
  } else {
    contextWindow = chapterContent.slice(0, CONTEXT_TRUNCATE_INLINE * 2)
  }

  const messages = [
    {
      role: 'system' as const,
      content:
        `你是一位专业的小说作家。请将用户选中的文本进行重写，使其质量更高。保持原有的情节走向和关键信息，但可以改变表达方式、句式结构和描写手法。必须使用自然的段落换行（用空行分段），不要生成一整段没有换行的文字。只返回重写后的内容，不要其他说明。${novel?.styleGuide ? `\n\n## 风格指南\n${novel.styleGuide}` : ''}`
    },
    {
      role: 'user' as const,
      content: `小说：${novel?.title || '未命名'}${novel?.genre ? `（${novel.genre}）` : ''}\n章节：第${chapter?.chapterNumber || '?'}章「${chapter?.title || ''}」${characterContext}\n${ragContextSection}\n章节上下文（选中位置前后）：\n${contextWindow}\n\n需要重写的段落：\n${data.selectedText}${data.direction ? `\n\n重写方向：${data.direction}` : ''}`
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

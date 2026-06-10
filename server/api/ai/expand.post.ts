import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
import { toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import {
  MAX_TOKENS_ACTION,
  CONTEXT_TRUNCATE_INLINE
} from '../../utils/ai-constants'
import {
  ChapterSchema,
  NovelSchema,
  CharacterSchema
} from '../../database/entities'
import { gatherRelevantContext } from '../../services/chapter-context'

const expandSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  selectedText: z.string().min(1),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = expandSchema.parse(body)
  const em = useEm(event)

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: '小说不存在' })
  const chapter = await em.findOne(
    ChapterSchema,
    {
      id: data.chapterId,
      novel: { user: auth.userId },
      deletedAt: null
    },
    { populate: ['content'] }
  )
  if (!chapter) throw createError({ statusCode: 404, message: '章节不存在' })
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  // RAG: 按需检索（query-only，廉价模型产 query；失败回落 seed-only）
  const { retrievedNotes } = await gatherRelevantContext(em, {
    novelId: data.novelId,
    userId: auth.userId,
    intent: '扩写',
    seed: data.selectedText.slice(0, 200),
    depth: 'query-only',
    topK: 6
  })
  let ragContextSection = ''
  if (retrievedNotes.length) {
    ragContextSection = '\n## 相关上下文\n'
    for (const item of retrievedNotes) {
      const label = item.characterName || `[${item.contentType}]`
      ragContextSection += `- ${label}：${item.content}\n`
    }
  }

  const chapterContent = chapter?.content || ''
  const characterContext =
    characters.length > 0 ?
      `\n角色：${characters
        .slice(0, 8)
        .map((c) => `${c.name}${c.traits ? `(${c.traits})` : ''}`)
        .join('、')}`
    : ''

  // Extract context around the selection, not from the beginning
  const selIdx = chapterContent.indexOf(data.selectedText)
  let contextWindow = ''
  if (selIdx >= 0) {
    const before = chapterContent.slice(
      Math.max(0, selIdx - CONTEXT_TRUNCATE_INLINE),
      selIdx
    )
    const after = chapterContent.slice(
      selIdx + data.selectedText.length,
      selIdx + data.selectedText.length + CONTEXT_TRUNCATE_INLINE
    )
    contextWindow = `...${before}【选中部分：${data.selectedText}】${after}...`
  } else {
    contextWindow = chapterContent.slice(0, CONTEXT_TRUNCATE_INLINE * 2)
  }

  const messages = [
    {
      role: 'user' as const,
      content: `小说：${novel?.title || '未命名'}${novel?.genre ? `（${novel.genre}）` : ''}\n章节：第${chapter?.chapterNumber || '?'}章「${chapter?.title || ''}」${characterContext}\n${ragContextSection}\n章节上下文（选中位置前后）：\n${contextWindow}\n\n需要扩写的段落：\n${data.selectedText}${data.direction ? `\n\n扩写方向：${data.direction}` : ''}${novel?.styleGuide ? `\n\n风格指南：${novel.styleGuide}` : ''}\n\n请将选中的文本进行扩写，使其更加丰富、生动、细腻。保持原有的风格和语气，不要改变情节走向。必须使用自然的段落换行（用空行分段），不要生成一整段没有换行的文字。只返回扩写后的内容，不要其他说明。`
    }
  ]

  return createInlineStreamResponse(
    event,
    {
      ...toAiOptions(aiConfig, {
        messages,
        temperature: parseFloat(aiConfig.temperature || '0.7'),
        maxTokens: MAX_TOKENS_ACTION,
        extraBody: PROSE_SAMPLING
      })
    },
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }
  )
})

import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
import { toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { MAX_TOKENS_ACTION, CONTEXT_TRUNCATE_CHAPTER } from '../../utils/ai-constants'
import { ChapterSchema, NovelSchema, CharacterSchema } from '../../database/entities'
import { getActiveForeshadowing } from '../../services/content-rag'
import { gatherRelevantContext } from '../../services/chapter-context'

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

  
  const isEnding = data.direction?.includes('自然收尾')

  // RAG: 按需检索（query-only，廉价模型产 query；失败回落 seed-only）。
  // 「自然收尾」分支不检索——短自包含任务，保持原样。
  let ragContextSection = ''
  if (!isEnding) {
    const { retrievedNotes } = await gatherRelevantContext(em, {
      novelId: data.novelId,
      userId: auth.userId,
      intent: '续写衔接',
      seed: [chapter.title, data.contextBefore.slice(-200), data.direction].filter(Boolean).join(' '),
      depth: 'query-only',
      topK: 8
    })
    if (retrievedNotes.length) {
      ragContextSection = '\n## 相关上下文（基于续写位置检索）\n'
      for (const item of retrievedNotes) {
        const label = item.characterName || `[${item.contentType}]`
        ragContextSection += `- ${label}：${item.content}\n`
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
      content: isEnding
        ? `你是一位专业的小说作家。用户要求你为当前章节写一个自然的段落结尾。\n\n严格要求：\n- 只输出1-2个短段落，总共100-200字\n- 必须给出完整的收束，让情节有一个明确的落点\n- 不要开启新的情节线，不要引入新角色\n- 直接写出结尾内容，不要解释、不要总结\n- 这是一个短任务，不需要长篇思考`
        : `你是一位专业的小说作家。请根据上下文，在光标位置之后继续创作小说内容。保持原有的风格、语气和叙事节奏，确保情节连贯自然。必须使用自然的段落换行（用空行分段），不要生成一整段没有换行的文字。只返回续写的内容，不要其他说明。${novel.styleGuide ? `\n\n## 风格指南\n${novel.styleGuide}` : ''}`
    },
    {
      role: 'user' as const,
      content: isEnding
        ? `小说：${novel.title}${novel.genre ? `（${novel.genre}）` : ''}\n章节：第${chapter.chapterNumber}章「${chapter.title}」${characterContext}\n\n光标前的内容：\n${data.contextBefore.slice(-CONTEXT_TRUNCATE_CHAPTER)}\n\n请直接为本章写一个简短的自然结尾（100-200字），给出完整的收束感。`
        : `小说：${novel.title}${characterContext}${ragContextSection}${foreshadowSection}\n\n光标前的内容${novel.genre ? `（${novel.genre}）` : ''}\n章节：第${chapter.chapterNumber}章「${chapter.title}」${characterContext}\n\n光标前的内容（需从此处续写）：\n${data.contextBefore.slice(-CONTEXT_TRUNCATE_CHAPTER)}${data.direction ? `\n\n续写方向：${data.direction}` : ''}`
    }
  ]

  return createInlineStreamResponse(event, {
    ...toAiOptions(aiConfig, {
      messages,
      temperature: parseFloat(aiConfig.temperature || '0.7'),
      maxTokens: MAX_TOKENS_ACTION,
      extraBody: PROSE_SAMPLING,
    }),
  }, { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model })
})

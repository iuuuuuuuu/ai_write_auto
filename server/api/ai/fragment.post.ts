import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { MAX_TOKENS_FRAGMENT, CONTEXT_TRUNCATE_FRAGMENT } from '../../utils/ai-constants'
import { ChapterSchema, NovelSchema, CharacterSchema } from '../../database/entities'

const fragmentSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  type: z.enum(['dialogue', 'description', 'action', 'monologue']),
  contextBefore: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

const TYPE_PROMPTS: Record<string, string> = {
  dialogue: '你是一位专业的小说作家。请根据上下文，生成一段精彩的人物对话。对话要自然、有个性、能推动情节。必须使用自然的段落换行（用空行分段），不要生成一整段没有换行的文字。只返回对话内容，不要其他说明。',
  description: '你是一位专业的小说作家。请根据上下文，生成一段环境或场景描写。注重感官细节、氛围营造和空间感。必须使用自然的段落换行（用空行分段），不要生成一整段没有换行的文字。只返回描写内容，不要其他说明。',
  action: '你是一位专业的小说作家。请根据上下文，生成一段动作场景。节奏紧凑、画面感强、动词精准。必须使用自然的段落换行（用空行分段），不要生成一整段没有换行的文字。只返回动作内容，不要其他说明。',
  monologue: '你是一位专业的小说作家。请根据上下文，生成一段角色内心独白。深入角色心理、情感真挚、推动人物塑造。必须使用自然的段落换行（用空行分段），不要生成一整段没有换行的文字。只返回独白内容，不要其他说明。'
}

const TYPE_LABELS: Record<string, string> = {
  dialogue: '对话',
  description: '环境描写',
  action: '动作场景',
  monologue: '内心独白'
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = fragmentSchema.parse(body)
  const em = useEm(event)

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)

  const chapter = await em.findOne(ChapterSchema, {
    id: data.chapterId,
    novel: { user: auth.userId },
    deletedAt: null,
  }, { populate: ['content'] })
  if (!chapter) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const chapterContent = chapter.content || ''
  const context = data.contextBefore || chapterContent.slice(-CONTEXT_TRUNCATE_FRAGMENT)
  const characterContext = characters.length > 0
    ? `\n角色：${characters.slice(0, 8).map(c => `${c.name}${c.traits ? `(${c.traits})` : ''}`).join('、')}`
    : ''

  const systemPrompt: string = TYPE_PROMPTS[data.type] ?? TYPE_PROMPTS.dialogue!
  const typeLabel: string = TYPE_LABELS[data.type] ?? '内容'

  const messages = [
    {
      role: 'system' as const,
      content: `${systemPrompt}${novel?.styleGuide ? `\n\n## 风格指南\n${novel.styleGuide}` : ''}`
    },
    {
      role: 'user' as const,
      content: `小说：${novel?.title || '未命名'}
章节：${chapter.title}${characterContext}

上下文（光标前的内容）：
${context}

请生成一段${typeLabel}，直接在此处接续上下文。保持与原文一致的风格和语气。`
    }
  ]

  return createInlineStreamResponse(event, {
    ...toAiOptions(aiConfig, {
      messages,
      temperature: parseFloat(aiConfig.temperature || '0.75'),
      maxTokens: MAX_TOKENS_FRAGMENT,
    }),
  }, { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model })
})

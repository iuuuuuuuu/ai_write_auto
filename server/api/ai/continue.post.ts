import { z } from 'zod'
import { streamAi } from '../../utils/ai-client'
import { createRequestSignal } from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
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
  const chapter = await em.findOne(ChapterSchema, {
    id: data.chapterId,
    novel: { user: auth.userId },
    deletedAt: null,
  })
  if (!chapter) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const chapterContent = chapter.content || ''
  const characterContext = characters.length > 0
    ? `\n角色：${characters.slice(0, 8).map(c => `${c.name}${c.traits ? `(${c.traits})` : ''}`).join('、')}`
    : ''

  const messages = [
    {
      role: 'system' as const,
      content:
        `你是一位专业的小说作家。请根据上下文，在光标位置之后继续创作小说内容。保持原有的风格、语气和叙事节奏，确保情节连贯自然。只返回续写的内容，不要其他说明。${novel?.styleGuide ? `\n\n## 风格指南\n${novel.styleGuide}` : ''}`
    },
    {
      role: 'user' as const,
      content: `小说：${novel?.title || '未命名'}${novel?.genre ? `（${novel.genre}）` : ''}\n章节：第${chapter.chapterNumber}章「${chapter.title}」${characterContext}\n\n光标前的内容（需从此处续写）：\n${data.contextBefore}${data.direction ? `\n\n续写方向：${data.direction}` : ''}`
    }
  ]

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))
      try {
        for await (const chunk of streamAi({
          apiUrl: aiConfig.apiUrl,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          messages,
          temperature: parseFloat(aiConfig.temperature || '0.7'),
          maxTokens: 2000,
          stream: true,
          signal: createRequestSignal(event)
        })) {
          if (chunk.content) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`
              )
            )
          }
          if (chunk.done) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: '', done: true })}\n\n`
              )
            )
            controller.close()
            return
          }
        }
      } catch (err: unknown) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'AI continue failed', done: true })}\n\n`
          )
        )
        controller.close()
      }
    }
  })

  return new Response(stream)
})

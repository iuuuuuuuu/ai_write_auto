import { z } from 'zod'
import { streamAi } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { checkRateLimit } from '../../utils/rate-limit'
import { ChapterSchema } from '../../database/entities'

const expandSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  selectedText: z.string().min(1),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const rateCheck = checkRateLimit(auth.userId)
  if (!rateCheck.allowed) {
    throw createError({
      statusCode: 429,
      message: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetIn / 1000)}s`
    })
  }

  const body = await readBody(event)
  const data = expandSchema.parse(body)
  const em = useEm(event)

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)

  const chapter = await em.findOne(ChapterSchema, {
    id: data.chapterId,
    novel: { user: auth.userId },
    deletedAt: null,
  })

  const chapterContent = chapter?.content || ''

  const messages = [
    {
      role: 'system' as const,
      content:
        '你是一位专业的小说作家。请将用户选中的文本进行扩写，使其更加丰富、生动、细腻。保持原有的风格和语气，不要改变情节走向。只返回扩写后的内容，不要其他说明。'
    },
    {
      role: 'user' as const,
      content: `章节上下文（供参考）：\n${chapterContent.slice(0, 2000)}\n\n需要扩写的段落：\n${data.selectedText}${data.direction ? `\n\n扩写方向：${data.direction}` : ''}`
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
      try {
        for await (const chunk of streamAi({
          apiUrl: aiConfig.apiUrl,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          messages,
          temperature: parseFloat(aiConfig.temperature || '0.7'),
          maxTokens: 2000,
          stream: true
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
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: err.message, done: true })}\n\n`
          )
        )
        controller.close()
      }
    }
  })

  return new Response(stream)
})

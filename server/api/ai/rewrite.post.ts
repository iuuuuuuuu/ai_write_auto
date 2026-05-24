import { z } from 'zod'
import { streamAi } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { ChapterSchema } from '../../database/entities'

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
        '你是一位专业的小说作家。请将用户选中的文本进行重写，使其质量更高。保持原有的情节走向和关键信息，但可以改变表达方式、句式结构和描写手法。只返回重写后的内容，不要其他说明。'
    },
    {
      role: 'user' as const,
      content: `章节上下文（供参考）：\n${chapterContent.slice(0, 2000)}\n\n需要重写的段落：\n${data.selectedText}${data.direction ? `\n\n重写方向：${data.direction}` : ''}`
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

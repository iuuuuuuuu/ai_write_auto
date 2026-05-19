import { z } from 'zod'
import { streamAi } from '../../utils/ai-client'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import { checkRateLimit } from '../../utils/rate-limit'

const generateSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  direction: z.string().optional(),
  chapterOutline: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
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
  const data = generateSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveUserAiConfig(em, auth.userId, 'generation', data.aiConfigId)

  const chapters = await em.find('Chapter', { novel: data.novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' } })
  const characters = await em.find('Character', { novel: data.novelId })
  const plotPoints = await em.find('PlotPoint', { novel: data.novelId })
  const storyArcs = await em.find('StoryArc', { novel: data.novelId })

  const messages = buildGenerationPrompt({
    novel,
    chapters,
    characters,
    plotPoints,
    storyArcs,
    currentChapterOutline: data.chapterOutline,
    userDirection: data.direction
  })
  const task = em.create('GenerationTask', {
    novel: data.novelId,
    chapter: data.chapterId || null,
    type: 'generate',
    status: 'running',
  })
  await em.flush()
  const taskId = (task as any).id

  const temperature =
    data.temperature ? parseFloat(String(data.temperature))
    : (novel as any).aiTemperature ? parseFloat((novel as any).aiTemperature)
    : parseFloat(aiConfig.temperature || '0.7')

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullContent = ''
      let totalTokens = 0

      try {
        for await (const chunk of streamAi({
          apiUrl: aiConfig.apiUrl,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          messages,
          temperature,
          maxTokens: aiConfig.maxTokens || 4096,
          stream: true
        })) {
          if (chunk.content) {
            fullContent += chunk.content
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`
              )
            )
          }
          if (chunk.usage) {
            totalTokens =
              (chunk.usage.prompt_tokens || 0) +
              (chunk.usage.completion_tokens || 0)
          }
          if (chunk.done) {
            await em.nativeUpdate('GenerationTask', { id: taskId }, {
              status: 'completed',
              result: fullContent,
              tokensUsed: totalTokens,
              completedAt: new Date()
            })

            if (totalTokens > 0) {
              em.create('TokenUsage', {
                user: auth.userId,
                aiConfig: aiConfig.id,
                tokensInput: chunk.usage?.prompt_tokens || 0,
                tokensOutput: chunk.usage?.completion_tokens || 0,
              })
              await em.flush()
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: '', done: true, taskId })}\n\n`
              )
            )
            controller.close()
            return
          }
        }
      } catch (err: any) {
        await em.nativeUpdate('GenerationTask', { id: taskId }, {
          status: 'failed',
          error: err.message
        })

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

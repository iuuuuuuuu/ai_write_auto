import { z } from 'zod'
import { streamAi } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import { checkRateLimit } from '../../utils/rate-limit'
import { NovelSchema, ChapterSchema, CharacterSchema, PlotPointSchema, StoryArcSchema, GenerationTaskSchema, TokenUsageSchema } from '../../database/entities'

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

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)

  const chapters = await em.find(ChapterSchema, { novel: data.novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' } })
  const characters = await em.find(CharacterSchema, { novel: data.novelId })
  const plotPoints = await em.find(PlotPointSchema, { novel: data.novelId })
  const storyArcs = await em.find(StoryArcSchema, { novel: data.novelId })

  const messages = buildGenerationPrompt({
    novel,
    chapters,
    characters,
    plotPoints,
    storyArcs,
    currentChapterOutline: data.chapterOutline,
    userDirection: data.direction
  })
  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    chapter: data.chapterId || null,
    type: 'generate',
    status: 'running',
  })
  await em.flush()
  const taskId = task.id

  const temperature =
    data.temperature ? parseFloat(String(data.temperature))
    : novel.aiTemperature ? parseFloat(novel.aiTemperature)
    : parseFloat(aiConfig.temperature ?? '0.7')

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
            await em.nativeUpdate(GenerationTaskSchema, { id: taskId }, {
              status: 'completed',
              result: fullContent,
              tokensUsed: totalTokens,
              completedAt: new Date()
            })

            if (totalTokens > 0) {
              em.create(TokenUsageSchema, {
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
        await em.nativeUpdate(GenerationTaskSchema, { id: taskId }, {
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

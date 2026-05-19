import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { streamAi } from '../../utils/ai-client'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import { checkRateLimit } from '../../utils/rate-limit'

const generateSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  direction: z.string().optional(),
  chapterOutline: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  model: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const rateCheck = checkRateLimit(auth.userId)
  if (!rateCheck.allowed) {
    throw createError({ statusCode: 429, message: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetIn / 1000)}s` })
  }

  const body = await readBody(event)
  const data = generateSchema.parse(body)

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.id, data.novelId), eq(schema.novels.userId, auth.userId)))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }
  const novel = novels[0]

  const aiConfigs = await (db as any)
    .select()
    .from(schema.aiConfigs)
    .where(and(eq(schema.aiConfigs.userId, auth.userId), eq(schema.aiConfigs.purpose, 'generation')))
    .limit(1)

  if (!aiConfigs.length) {
    throw createError({ statusCode: 400, message: 'No AI config found for generation' })
  }
  const aiConfig = aiConfigs[0]

  const chapters = await (db as any)
    .select()
    .from(schema.chapters)
    .where(and(eq(schema.chapters.novelId, data.novelId), isNull(schema.chapters.deletedAt)))
    .orderBy(schema.chapters.chapterNumber)

  const characters = await (db as any)
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.novelId, data.novelId))

  const plotPoints = await (db as any)
    .select()
    .from(schema.plotPoints)
    .where(eq(schema.plotPoints.novelId, data.novelId))

  const storyArcs = await (db as any)
    .select()
    .from(schema.storyArcs)
    .where(eq(schema.storyArcs.novelId, data.novelId))

  const messages = buildGenerationPrompt({
    novel,
    chapters,
    characters,
    plotPoints,
    storyArcs,
    currentChapterOutline: data.chapterOutline,
    userDirection: data.direction,
  })

  const taskResult = await (db as any).insert(schema.generationTasks).values({
    novelId: data.novelId,
    chapterId: data.chapterId || null,
    type: 'generate',
    status: 'running',
  }).returning()
  const taskId = taskResult[0].id

  const temperature = data.temperature
    ? parseFloat(String(data.temperature))
    : novel.aiTemperature
      ? parseFloat(novel.aiTemperature)
      : parseFloat(aiConfig.temperature || '0.7')

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
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
          model: data.model || aiConfig.model,
          messages,
          temperature,
          maxTokens: aiConfig.maxTokens || 4096,
          stream: true,
        })) {
          if (chunk.content) {
            fullContent += chunk.content
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`))
          }
          if (chunk.usage) {
            totalTokens = (chunk.usage.prompt_tokens || 0) + (chunk.usage.completion_tokens || 0)
          }
          if (chunk.done) {
            await (db as any)
              .update(schema.generationTasks)
              .set({ status: 'completed', result: fullContent, tokensUsed: totalTokens, completedAt: new Date() })
              .where(eq(schema.generationTasks.id, taskId))

            if (totalTokens > 0) {
              await (db as any).insert(schema.tokenUsage).values({
                userId: auth.userId,
                aiConfigId: aiConfig.id,
                tokensInput: chunk.usage?.prompt_tokens || 0,
                tokensOutput: chunk.usage?.completion_tokens || 0,
              })
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true, taskId })}\n\n`))
            controller.close()
            return
          }
        }
      } catch (err: any) {
        await (db as any)
          .update(schema.generationTasks)
          .set({ status: 'failed', error: err.message })
          .where(eq(schema.generationTasks.id, taskId))

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream)
})

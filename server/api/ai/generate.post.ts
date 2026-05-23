import { z } from 'zod'
import { streamAi } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import { NovelSchema, ChapterSchema, CharacterSchema, PlotPointSchema, StoryArcSchema, GenerationTaskSchema, TokenUsageSchema, ModelCostRateSchema } from '../../database/entities'
import { isEmbeddingReady } from '../../services/embedding'
import { retrieveRelevant } from '../../services/character-rag'
import { recordAiGeneration } from '../../utils/writing-stats'

const generateSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  direction: z.string().optional(),
  chapterOutline: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(128000).optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

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

  let ragContext: Array<{ characterName: string; content: string; contentType: string; chapterId: number | null }> | undefined
  if (isEmbeddingReady()) {
    const query = [data.chapterOutline, data.direction].filter(Boolean).join(' ')
    if (query) {
      ragContext = await retrieveRelevant(data.novelId, query, 10)
    }
  }

  const messages = buildGenerationPrompt({
    novel,
    chapters,
    characters,
    plotPoints,
    storyArcs,
    currentChapterOutline: data.chapterOutline,
    userDirection: data.direction,
    ragContext
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
          maxTokens: data.maxTokens || aiConfig.maxTokens || 4096,
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
              const inputTokens = chunk.usage?.prompt_tokens || 0
              const outputTokens = chunk.usage?.completion_tokens || 0
              let estimatedCost: string | null = null

              const costRate = await em.findOne(ModelCostRateSchema, { user: auth.userId, model: aiConfig.model })
              if (costRate) {
                const cost = (inputTokens * parseFloat(costRate.inputCostPer1k) / 1000)
                  + (outputTokens * parseFloat(costRate.outputCostPer1k) / 1000)
                estimatedCost = cost.toFixed(6)
              }

              em.create(TokenUsageSchema, {
                user: auth.userId,
                aiConfig: aiConfig.id,
                tokensInput: inputTokens,
                tokensOutput: outputTokens,
                estimatedCost
              })
              await em.flush()
            }

            await recordAiGeneration(em, auth.userId)

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

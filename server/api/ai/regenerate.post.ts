import { z } from 'zod'
import {
  createTrackedStreamResponse,
  prepareBudgetedAiOptions
} from '../../utils/ai-stream'
import { toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildRegenerationPrompt } from '../../utils/ai-prompts'
import {
  NovelSchema,
  ChapterSchema,
  CharacterSchema,
  PlotPointSchema,
  StoryArcSchema,
  GenerationTaskSchema
} from '../../database/entities'
import { getActiveForeshadowing } from '../../services/content-rag'
import { gatherRelevantContext } from '../../services/chapter-context'
import { filterUsablePlotPoints } from '../../utils/plot-points'

const regenerateSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  previousResult: z.string().min(1),
  feedback: z.string().min(1).max(2000),
  aiConfigId: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0.01).max(1).optional(),
  thinkingEnabled: z.boolean().optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  maxTokens: z.number().int().min(256).max(128000).optional()
})

function resolveMinimumInputTokens(contextWindowTokens: number): number {
  return Math.max(4096, Math.floor(contextWindowTokens * 0.25))
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = regenerateSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )

  const chapters = await em.find(
    ChapterSchema,
    { novel: data.novelId, deletedAt: null },
    { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] }
  )
  const characters = await em.find(CharacterSchema, { novel: data.novelId })
  const allPlotPoints = await em.find(
    PlotPointSchema,
    { novel: data.novelId },
    { populate: ['chapter'] }
  )
  const plotPoints = filterUsablePlotPoints(allPlotPoints)
  const storyArcs = await em.find(StoryArcSchema, { novel: data.novelId })

  const currentChapter =
    data.chapterId ? chapters.find((ch) => ch.id === data.chapterId) : undefined

  let foreshadowing:
    | Array<{
        content: string
        description: string | null
        chapterNumber: number | null
      }>
    | undefined
  try {
    foreshadowing = await getActiveForeshadowing(data.novelId)
  } catch {}

  // RAG: 按需检索（query-only，廉价模型产 query；失败回落 seed-only），注入 buildRegenerationPrompt 现有 ragContext 槽
  const { retrievedNotes } = await gatherRelevantContext(em, {
    novelId: data.novelId,
    userId: auth.userId,
    intent: '按反馈重写',
    seed: [currentChapter?.title, data.feedback].filter(Boolean).join(' '),
    depth: 'query-only',
    topK: 10
  })

  const messages = buildRegenerationPrompt({
    novel,
    chapters,
    characters,
    plotPoints,
    storyArcs,
    currentChapter:
      currentChapter ?
        {
          title: currentChapter.title,
          chapterNumber: currentChapter.chapterNumber
        }
      : undefined,
    currentChapterOutline: currentChapter?.summary || undefined,
    previousResult: data.previousResult,
    feedback: data.feedback,
    ragContext: retrievedNotes,
    foreshadowing
  })

  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    chapter: data.chapterId || null,
    type: 'regenerate',
    status: 'running'
  })
  await em.flush()

  const desiredOutputTokens = data.maxTokens || aiConfig.maxTokens || 4096
  const budgeted = prepareBudgetedAiOptions(
    toAiOptions(aiConfig, {
      messages,
      temperature: data.temperature,
      topP: data.topP,
      thinkingEnabled: data.thinkingEnabled,
      reasoningEffort: data.reasoningEffort,
      maxTokens: desiredOutputTokens,
      extraBody: PROSE_SAMPLING,
      tracking: {
        userId: auth.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'generation',
        scenario: 'chapter_regenerate',
        source: 'api_route',
        endpoint: '/api/ai/regenerate',
        novelId: data.novelId,
        chapterId: data.chapterId || null,
        taskId: task.id
      }
    }),
    {
      contextWindowTokens: aiConfig.contextWindowTokens,
      desiredOutputTokens,
      reserveTokens: 1024,
      minOutputTokens: 1024,
      minimumInputTokens: resolveMinimumInputTokens(aiConfig.contextWindowTokens)
    }
  )

  return createTrackedStreamResponse(
    event,
    budgeted.options,
    {
      em,
      userId: auth.userId,
      configId: aiConfig.id,
      model: aiConfig.model
    },
    {
      taskId: task.id,
      trackStats: true,
      budget: budgeted.budget
    }
  )
})

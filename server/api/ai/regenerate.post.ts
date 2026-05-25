import { z } from 'zod'
import { createTrackedStreamResponse } from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildRegenerationPrompt } from '../../utils/ai-prompts'
import { NovelSchema, ChapterSchema, CharacterSchema, PlotPointSchema, StoryArcSchema, GenerationTaskSchema } from '../../database/entities'
import { isEmbeddingReady } from '../../services/embedding'
import { retrieveRelevant } from '../../services/character-rag'

const regenerateSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  previousResult: z.string().min(1),
  feedback: z.string().min(1).max(2000),
  aiConfigId: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(128000).optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = regenerateSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)

  const chapters = await em.find(ChapterSchema, { novel: data.novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] })
  const characters = await em.find(CharacterSchema, { novel: data.novelId })
  const plotPoints = await em.find(PlotPointSchema, { novel: data.novelId })
  const storyArcs = await em.find(StoryArcSchema, { novel: data.novelId })

  const currentChapter = data.chapterId
    ? chapters.find(ch => ch.id === data.chapterId)
    : undefined

  let ragContext: Array<{ characterName: string; content: string; contentType: string; chapterId: number | null }> | undefined
  if (isEmbeddingReady()) {
    const query = [currentChapter?.title, data.feedback].filter(Boolean).join(' ')
    if (query) {
      ragContext = await retrieveRelevant(data.novelId, query, 10)
    }
  }

  const messages = buildRegenerationPrompt({
    novel,
    chapters,
    characters,
    plotPoints,
    storyArcs,
    currentChapter: currentChapter ? { title: currentChapter.title, chapterNumber: currentChapter.chapterNumber } : undefined,
    currentChapterOutline: currentChapter?.summary || undefined,
    previousResult: data.previousResult,
    feedback: data.feedback,
    ragContext
  })

  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    chapter: data.chapterId || null,
    type: 'regenerate',
    status: 'running',
  })
  await em.flush()

  const temperature =
    data.temperature ? parseFloat(String(data.temperature))
    : novel.aiTemperature ? parseFloat(novel.aiTemperature)
    : parseFloat(aiConfig.temperature ?? '0.7')

  return createTrackedStreamResponse(event, {
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature,
    maxTokens: data.maxTokens || aiConfig.maxTokens || 4096,
  }, {
    em,
    userId: auth.userId,
    configId: aiConfig.id,
    model: aiConfig.model
  }, {
    taskId: task.id,
    trackStats: true
  })
})

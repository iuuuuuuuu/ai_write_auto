import { z } from 'zod'
import { createTrackedStreamResponse } from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import { NovelSchema, ChapterSchema, CharacterSchema, PlotPointSchema, StoryArcSchema, GenerationTaskSchema, NovelOutlineSchema } from '../../database/entities'
import { isEmbeddingReady } from '../../services/embedding'
import { retrieveRelevant, getActiveForeshadowing } from '../../services/content-rag'

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

  const chapters = await em.find(ChapterSchema, { novel: data.novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] })
  const currentChapter = data.chapterId ? chapters.find(c => c.id === data.chapterId) : undefined
  const precedingChapters = currentChapter
    ? chapters.filter(c => c.chapterNumber < currentChapter.chapterNumber)
    : chapters
  const characters = await em.find(CharacterSchema, { novel: data.novelId })
  const plotPoints = await em.find(PlotPointSchema, { novel: data.novelId })
  const storyArcs = await em.find(StoryArcSchema, { novel: data.novelId })

  let chapterOutline = data.chapterOutline
  if (!chapterOutline && currentChapter) {
    const outline = await em.findOne(NovelOutlineSchema, { novel: data.novelId, chapterNumber: currentChapter.chapterNumber })
    if (outline) chapterOutline = outline.description
  }

  let foreshadowing: Array<{ content: string; description: string | null; chapterNumber: number | null }> | undefined
  try { foreshadowing = await getActiveForeshadowing(data.novelId) } catch {}

  const recentChapterContent: Array<{ chapterNumber: number; title: string; content: string }> = []
  for (const ch of precedingChapters.slice(-2)) {
    if (ch.content) recentChapterContent.push({ chapterNumber: ch.chapterNumber, title: ch.title, content: ch.content.slice(-4000) })
  }

  let ragContext: Array<{ characterName: string; content: string; contentType: string; chapterId: number | null }> | undefined
  if (isEmbeddingReady()) {
    const query = [currentChapter?.title, chapterOutline, data.direction].filter(Boolean).join(' ')
    if (query) {
      ragContext = await retrieveRelevant(data.novelId, query, 10)
    }
  }

  const messages = buildGenerationPrompt({
    novel,
    chapters: precedingChapters,
    characters,
    plotPoints,
    storyArcs,
    currentChapter: currentChapter ? { title: currentChapter.title, chapterNumber: currentChapter.chapterNumber } : undefined,
    currentChapterOutline: chapterOutline,
    userDirection: data.direction,
    ragContext,
    foreshadowing,
    recentChapterContent
  })

  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    chapter: data.chapterId || null,
    type: 'generate',
    status: 'running',
  })
  await em.flush()

  const temperature =
    data.temperature ? parseFloat(String(data.temperature))
    : novel.aiTemperature ? parseFloat(novel.aiTemperature)
    : parseFloat(aiConfig.temperature ?? '0.7')

  return createTrackedStreamResponse(event, {
    ...toAiOptions(aiConfig, { messages, temperature, maxTokens: data.maxTokens || aiConfig.maxTokens || 4096 }),
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

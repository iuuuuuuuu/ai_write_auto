import { z } from 'zod'
import { createTrackedStreamResponse } from '../../utils/ai-stream'
import { toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { NovelSchema, ChapterSchema, CharacterSchema, PlotPointSchema, StoryArcSchema, GenerationTaskSchema, NovelOutlineSchema } from '../../database/entities'
import { getActiveForeshadowing } from '../../services/content-rag'
import { prepareChapterContext } from '../../services/chapter-context'
import { ensureChapterOutline } from '../../services/outline-autofill'
import { resolveSkillIdsForNovel } from '../../utils/writing-skills'

const generateSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  direction: z.string().optional(),
  chapterOutline: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(128000).optional(),
  aiConfigId: z.number().int().positive().optional(),
  skillIds: z.array(z.number().int().positive()).optional()
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
    // 先大纲、再正文：本章无显式大纲时，查库；仍缺失则自动生成一条并落库，
    // 保证生成流程不缺「大纲」这一环（失败则降级为无大纲续写，不阻断）。
    const existingOutlines = await em.find(NovelOutlineSchema, { novel: data.novelId }, { orderBy: { sortOrder: 'ASC' } })
    const ensured = await ensureChapterOutline({
      em,
      novel,
      novelId: data.novelId,
      chapterNumber: currentChapter.chapterNumber,
      characters,
      existingOutlines: existingOutlines.map(o => ({ chapterNumber: o.chapterNumber, description: o.description, sortOrder: o.sortOrder })),
      direction: data.direction,
      aiConfig,
      userId: auth.userId
    })
    chapterOutline = ensured.description
  }

  let foreshadowing: Array<{ content: string; description: string | null; chapterNumber: number | null }> | undefined
  try { foreshadowing = await getActiveForeshadowing(data.novelId) } catch {}

  const recentChapterContent: Array<{ chapterNumber: number; title: string; content: string }> = []
  for (const ch of precedingChapters.slice(-2)) {
    if (ch.content) recentChapterContent.push({ chapterNumber: ch.chapterNumber, title: ch.title, content: ch.content.slice(-4000) })
  }

  const skillIds = await resolveSkillIdsForNovel(em, {
    requestSkillIds: data.skillIds,
    novelEnabledRaw: novel.enabledSkillIds,
    genre: novel.genre
  })

  const { messages } = await prepareChapterContext(em, {
    novel,
    novelId: data.novelId,
    userId: auth.userId,
    currentChapter: currentChapter ? { title: currentChapter.title, chapterNumber: currentChapter.chapterNumber } : undefined,
    outline: chapterOutline,
    direction: data.direction,
    precedingChapters,
    characters,
    plotPoints,
    storyArcs,
    foreshadowing,
    recentChapterContent,
    depth: 'query-only',
    skillIds
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
    ...toAiOptions(aiConfig, { messages, temperature, maxTokens: data.maxTokens || aiConfig.maxTokens || 4096, extraBody: PROSE_SAMPLING }),
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

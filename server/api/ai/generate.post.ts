import { z } from 'zod'
import { createTrackedStreamResponse } from '../../utils/ai-stream'
import { toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { NovelSchema, GenerationTaskSchema } from '../../database/entities'
import { prepareChapterContext } from '../../services/chapter-context'
import { resolveChapterGenerationInputs } from '../../services/generation-context'

const contextSelectionSchema = z
  .object({
    includedKeys: z.array(z.string()).optional(),
    excludedKeys: z.array(z.string()).optional()
  })
  .optional()

const generateSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  direction: z.string().optional(),
  chapterOutline: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0.01).max(1).optional(),
  thinkingEnabled: z.boolean().optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  maxTokens: z.number().int().min(256).max(128000).optional(),
  aiConfigId: z.number().int().positive().optional(),
  skillIds: z.array(z.number().int().positive()).optional(),
  contextSelection: contextSelectionSchema
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = generateSchema.parse(body)
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

  const contextInputs = await resolveChapterGenerationInputs({
    em,
    novel,
    novelId: data.novelId,
    userId: auth.userId,
    chapterId: data.chapterId,
    chapterOutline: data.chapterOutline,
    direction: data.direction,
    aiConfig,
    requestSkillIds: data.skillIds
  })

  const { messages } = await prepareChapterContext(em, {
    novel,
    novelId: data.novelId,
    userId: auth.userId,
    currentChapter:
      contextInputs.currentChapter ?
        {
          title: contextInputs.currentChapter.title,
          chapterNumber: contextInputs.currentChapter.chapterNumber
        }
      : undefined,
    outline: contextInputs.chapterOutline,
    direction: data.direction,
    precedingChapters: contextInputs.precedingChapters,
    characters: contextInputs.characters,
    plotPoints: contextInputs.plotPoints,
    storyArcs: contextInputs.storyArcs,
    foreshadowing: contextInputs.foreshadowing,
    recentChapterContent: contextInputs.recentChapterContent,
    depth: 'query-only',
    skillIds: contextInputs.skillIds,
    contextSelection: data.contextSelection
  })

  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    chapter: data.chapterId || null,
    type: 'generate',
    status: 'running'
  })
  await em.flush()

  return createTrackedStreamResponse(
    event,
    {
      ...toAiOptions(aiConfig, {
        messages,
        temperature: data.temperature,
        topP: data.topP,
        thinkingEnabled: data.thinkingEnabled,
        reasoningEffort: data.reasoningEffort,
        maxTokens: data.maxTokens || aiConfig.maxTokens || 4096,
        extraBody: PROSE_SAMPLING
      })
    },
    {
      em,
      userId: auth.userId,
      configId: aiConfig.id,
      model: aiConfig.model
    },
    {
      taskId: task.id,
      trackStats: true
    }
  )
})

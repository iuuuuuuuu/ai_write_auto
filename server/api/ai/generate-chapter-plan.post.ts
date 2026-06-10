import { z } from 'zod'
import { callAiWithUsage, toAiOptions } from '../../utils/ai-client'
import { recordUsage } from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildChapterPlanGenerationPrompt } from '../../utils/ai-prompts'
import {
  NovelSchema,
  ChapterSchema,
  CharacterSchema,
  NovelOutlineSchema
} from '../../database/entities'

const chapterPlanSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  chapterOutline: z.string().min(1),
  characterIds: z.array(z.number().int().positive()).optional(),
  existingPlan: z
    .object({
      goal: z.string().optional(),
      mustInclude: z.string().optional(),
      avoid: z.string().optional(),
      pacing: z.string().optional(),
      protocol: z.string().optional()
    })
    .optional(),
  aiConfigId: z.number().int().positive().optional()
})

type ChapterPlanDraft = {
  goal: string
  mustInclude: string
  avoid: string
  pacing: string
  protocol: string
}

function getStringField(
  record: Record<string, unknown>,
  key: keyof ChapterPlanDraft
) {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

function parseChapterPlan(raw: string): ChapterPlanDraft {
  const cleaned = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  const source = match ? match[0] : cleaned
  const parsed = JSON.parse(source) as unknown
  const record =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed) ?
      (parsed as Record<string, unknown>)
    : {}

  return {
    goal: getStringField(record, 'goal'),
    mustInclude: getStringField(record, 'mustInclude'),
    avoid: getStringField(record, 'avoid'),
    pacing: getStringField(record, 'pacing'),
    protocol: getStringField(record, 'protocol')
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = chapterPlanSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const chapter = await em.findOne(ChapterSchema, {
    id: data.chapterId,
    novel: data.novelId,
    deletedAt: null
  })
  if (!chapter) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }

  const charactersPromise =
    data.characterIds ?
      data.characterIds.length ?
        em.find(CharacterSchema, {
          novel: data.novelId,
          id: { $in: data.characterIds }
        })
      : Promise.resolve([])
    : em.find(CharacterSchema, { novel: data.novelId })
  const [characters, outlines, aiConfig] = await Promise.all([
    charactersPromise,
    em.find(
      NovelOutlineSchema,
      { novel: data.novelId },
      { orderBy: { chapterNumber: 'ASC' } }
    ),
    resolveNovelAiConfig(
      em,
      auth.userId,
      data.novelId,
      'generation',
      data.aiConfigId
    )
  ])

  const messages = buildChapterPlanGenerationPrompt({
    novel,
    chapter: {
      title: chapter.title,
      chapterNumber: chapter.chapterNumber
    },
    chapterOutline: data.chapterOutline,
    characters,
    outlines: outlines.map((outline) => ({
      chapterNumber: outline.chapterNumber,
      description: outline.description
    })),
    existingPlan: data.existingPlan
  })

  const result = await callAiWithUsage(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.75,
      maxTokens: 1200
    })
  )
  await recordUsage(
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model },
    result.inputTokens,
    result.outputTokens
  )

  try {
    return { plan: parseChapterPlan(result.content) }
  } catch {
    throw createError({ statusCode: 502, message: 'AI 未返回可用的剧情草案' })
  }
})

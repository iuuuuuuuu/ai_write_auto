import { z } from 'zod'
import { toAiOptions } from '../../utils/ai-client'
import {
  createStreamResponse,
  prepareBudgetedAiOptions,
  standardAiBudgetOptions
} from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildChapterOutlinePrompt } from '../../utils/ai-prompts'
import {
  CharacterSchema,
  ChapterSchema,
  NovelOutlineSchema,
  NovelSchema
} from '../../database/entities'

const chapterOutlineSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  idea: z.string().optional(),
  currentOutline: z.string().optional(),
  existingOutlines: z
    .array(
      z.object({
        chapterNumber: z.number().int().positive(),
        description: z.string()
      })
    )
    .optional(),
  aiConfigId: z.number().int().positive().optional()
})

function cleanChapterOutline(raw: string, chapterNumber: number): string {
  const withoutThinking = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|?think\|?>[\s\S]*?<\/?\|?think\|?>/gi, '')
    .trim()
  const withoutFence = withoutThinking
    .replace(/^```(?:markdown|md|text|json)?\s*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()
  const firstUsefulBlock =
    withoutFence
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .find((part) => part.length > 0) || withoutFence

  return firstUsefulBlock
    .replace(new RegExp(`^第\\s*${chapterNumber}\\s*章[：:、.\\s-]*`), '')
    .replace(/^(本章大纲|章节大纲|大纲|outline)\s*[：:]\s*/i, '')
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .trim()
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = chapterOutlineSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId,
    deletedAt: null
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

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )

  const [characters, storedOutlines] = await Promise.all([
    em.find(CharacterSchema, { novel: data.novelId }),
    data.existingOutlines?.length ?
      Promise.resolve([])
    : em.find(
        NovelOutlineSchema,
        { novel: data.novelId },
        { orderBy: { chapterNumber: 'ASC' } }
      )
  ])

  const messages = buildChapterOutlinePrompt({
    novel,
    chapter: {
      chapterNumber: chapter.chapterNumber,
      title: chapter.title
    },
    characters,
    idea: data.idea,
    currentOutline: data.currentOutline,
    existingOutlines:
      data.existingOutlines?.length ?
        data.existingOutlines
      : storedOutlines.map((outline) => ({
          chapterNumber: outline.chapterNumber,
          description: outline.description
        }))
  })
  const desiredOutputTokens = 1200
  const budgeted = prepareBudgetedAiOptions(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.8,
      maxTokens: desiredOutputTokens,
      tracking: {
        userId: auth.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'generation',
        scenario: 'chapter_outline_generate',
        source: 'api_route',
        endpoint: '/api/ai/generate-chapter-outline',
        novelId: data.novelId,
        chapterId: data.chapterId
      }
    }),
    standardAiBudgetOptions(aiConfig.contextWindowTokens, desiredOutputTokens)
  )

  return createStreamResponse(
    event,
    budgeted.options,
    {
      em,
      userId: auth.userId,
      configId: aiConfig.configId,
      model: aiConfig.model
    },
    {
      transformFullContent: (content) =>
        cleanChapterOutline(content, chapter.chapterNumber),
      emptyMessage: 'AI 未返回有效大纲文本'
    }
  )
})

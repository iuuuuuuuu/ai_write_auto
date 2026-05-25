import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import {
  NovelSchema,
  ChapterSchema,
  ChapterVersionSchema
} from '../../../../database/entities'
import { enqueuePostProcessing } from '../../../../services/task-queue'
import { recordWordsWritten } from '../../../../utils/writing-stats'

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  status: z.enum(['draft', 'generated', 'edited', 'final']).optional(),
  chapterNumber: z.number().int().positive().optional(),
  expectedUpdatedAt: z.string().optional(),
  source: z.enum(['ai_generated', 'user_edited']).optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = Number(getRouterParam(event, 'id'))
  const chapterId = Number(getRouterParam(event, 'chapterId'))
  const body = await readBody(event)
  const data = updateChapterSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(ChapterSchema, {
    id: chapterId,
    novel: novelId,
    deletedAt: null
  }, { populate: ['content'] })
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })

  if (data.expectedUpdatedAt) {
    const serverTime = new Date(chapter.updatedAt).getTime()
    const clientTime = new Date(data.expectedUpdatedAt).getTime()
    if (serverTime - clientTime > 5000) {
      throw createError({
        statusCode: 409,
        message: 'Conflict: chapter was modified in another tab'
      })
    }
  }
  const { expectedUpdatedAt, ...updateFields } = data
  const updates: Partial<Omit<typeof data, 'expectedUpdatedAt'>> & {
    wordCount?: number
  } = { ...updateFields }
  const oldWordCount = chapter.wordCount || 0
  if (data.content !== undefined) {
    updates.wordCount = data.content.replace(/\s/g, '').length
  }

  const normalizeText = (text: string | null | undefined) =>
    (text ?? '').replace(/\s/g, '')

  const contentChanged = data.content !== undefined &&
    normalizeText(data.content) !== normalizeText(chapter.content)

  wrap(chapter).assign(updates)
  await em.flush()

  if (updates.wordCount !== undefined) {
    const delta = updates.wordCount - oldWordCount
    await recordWordsWritten(em, auth.userId, delta)
  }

  if (contentChanged) {
    const versions = await em.find(
      ChapterVersionSchema,
      { chapter: chapterId },
      { orderBy: { versionNumber: 'DESC' }, limit: 1 }
    )

    const lastVersion = versions[0]
    const isDuplicate = lastVersion && normalizeText(lastVersion.content) === normalizeText(data.content)

    if (!isDuplicate) {
      const versionCount = await em.count(ChapterVersionSchema, { chapter: chapterId })
      em.create(ChapterVersionSchema, {
        chapter: chapterId,
        versionNumber: versionCount + 1,
        content: data.content!,
        source: data.source || 'user_edited'
      })
      await em.flush()
    }

    await enqueuePostProcessing(novelId, chapterId)
  }

  return { ...chapter, updatedAt: new Date().toISOString() }
})

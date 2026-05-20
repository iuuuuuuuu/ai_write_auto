import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import {
  NovelSchema,
  ChapterSchema,
  ChapterVersionSchema
} from '../../../../database/entities'
import { enqueuePostProcessing } from '../../../../services/task-queue'

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  status: z.enum(['draft', 'generated', 'edited', 'final']).optional(),
  chapterNumber: z.number().int().positive().optional(),
  expectedUpdatedAt: z.string().optional()
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
  })
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })

  if (data.expectedUpdatedAt) {
    const serverTime = new Date(chapter.updatedAt).getTime()
    const clientTime = new Date(data.expectedUpdatedAt).getTime()
    if (serverTime > clientTime) {
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
  if (data.content !== undefined) {
    updates.wordCount = data.content.replace(/\s/g, '').length
  }

  wrap(chapter).assign(updates)
  await em.flush()

  if (data.content !== undefined) {
    const versions = await em.find(
      ChapterVersionSchema,
      { chapter: chapterId },
      { orderBy: { versionNumber: 'ASC' } }
    )

    em.create(ChapterVersionSchema, {
      chapter: chapterId,
      versionNumber: versions.length + 1,
      content: data.content,
      source: 'user_edited'
    })
    await em.flush()

    await enqueuePostProcessing(novelId, chapterId)
  }

  return chapter
})

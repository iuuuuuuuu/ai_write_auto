import { z } from 'zod'
import {
  ForeshadowingSchema,
  NovelSchema,
  ChapterSchema
} from '../../database/entities'

const schema = z.object({
  content: z.string().min(1).max(1000).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'resolved', 'abandoned']).optional(),
  chapterId: z.number().int().positive().optional().nullable(),
  resolvedAtChapter: z.number().int().positive().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const data = schema.parse(body)
  const em = useEm(event)

  const foreshadowing = await em.findOne(
    ForeshadowingSchema,
    { id },
    { populate: ['novel'] }
  )
  if (!foreshadowing)
    throw createError({ statusCode: 404, message: 'Not found' })
  if ((foreshadowing.novel as any).user !== auth.userId)
    throw createError({ statusCode: 403, message: 'Forbidden' })

  if (data.content !== undefined) foreshadowing.content = data.content
  if (data.description !== undefined)
    foreshadowing.description = data.description
  if (data.status !== undefined) foreshadowing.status = data.status
  if (data.chapterId !== undefined) {
    if (data.chapterId === null) {
      foreshadowing.chapter = null
    } else {
      const novel = foreshadowing.novel as any
      const chapter = await em.findOne(ChapterSchema, {
        id: data.chapterId,
        novel: novel.id,
        deletedAt: null
      })
      if (!chapter) {
        throw createError({ statusCode: 400, message: 'Chapter not found' })
      }
      foreshadowing.chapter = chapter
    }
  }
  if (data.resolvedAtChapter !== undefined)
    foreshadowing.resolvedAtChapter = data.resolvedAtChapter

  await em.flush()
  return {
    id: foreshadowing.id,
    content: foreshadowing.content,
    status: foreshadowing.status
  }
})

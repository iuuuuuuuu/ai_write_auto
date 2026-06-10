import { z } from 'zod'
import {
  NovelSchema,
  PlotPointSchema,
  ChapterSchema
} from '../../../database/entities'

const plotPointSchema = z.object({
  description: z.string().min(1),
  type: z.enum(['setup', 'conflict', 'resolution', 'twist']),
  status: z
    .enum(['introduced', 'developing', 'resolved'])
    .default('introduced'),
  chapterId: z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const body = await readBody(event)
  const data = plotPointSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  let chapter = null
  if (data.chapterId) {
    chapter = await em.findOne(ChapterSchema, {
      id: data.chapterId,
      novel: novelId,
      deletedAt: null
    })
    if (!chapter) {
      throw createError({ statusCode: 400, message: 'Chapter not found' })
    }
  }

  const plotPoint = em.create(PlotPointSchema, {
    novel: novelId,
    chapter,
    description: data.description,
    type: data.type,
    status: data.status
  })
  await em.flush()

  return plotPoint
})

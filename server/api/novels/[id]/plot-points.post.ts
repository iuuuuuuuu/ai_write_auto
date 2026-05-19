import { z } from 'zod'

const plotPointSchema = z.object({
  description: z.string().min(1),
  type: z.enum(['setup', 'conflict', 'resolution', 'twist']),
  status: z.enum(['introduced', 'developing', 'resolved']).default('introduced'),
  chapterId: z.number().int().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = plotPointSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const plotPoint = em.create('PlotPoint', {
    novel: novelId,
    chapter: data.chapterId || null,
    description: data.description,
    type: data.type,
    status: data.status,
  })
  await em.flush()

  return plotPoint
})

import { z } from 'zod'
import { wrap } from '@mikro-orm/core'

const updateNovelSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  genre: z.string().max(50).optional(),
  status: z.enum(['draft', 'in_progress', 'completed']).optional(),
  styleGuide: z.string().optional(),
  worldSetting: z.string().optional(),
  aiTemperature: z.string().optional(),
  aiExtraPrompt: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = updateNovelSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne('Novel', {
    id,
    user: auth.userId,
    deletedAt: null,
  })

  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  wrap(novel).assign({ ...data, updatedAt: new Date() })
  await em.flush()

  return novel
})

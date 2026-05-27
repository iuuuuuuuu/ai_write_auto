import { z } from 'zod'
import { NovelSchema, UserSchema } from '../../../database/entities'

const novelUpdateSchema = z.object({
  userId: z.number().int().positive().optional(),
  status: z.enum(['draft', 'in_progress', 'completed']).optional(),
}).refine(data => data.userId !== undefined || data.status !== undefined, {
  message: 'At least one field must be provided',
})

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseIntParam(event, 'id')
  const body = await readBody(event)
  const parsed = novelUpdateSchema.parse(body)

  const novel = await em.findOne(NovelSchema, { id })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  if (parsed.userId !== undefined) {
    const newOwner = await em.findOne(UserSchema, { id: parsed.userId })
    if (!newOwner) {
      throw createError({ statusCode: 400, message: 'Target user not found' })
    }
    novel.user = newOwner as any
  }

  if (parsed.status !== undefined) {
    novel.status = parsed.status
  }

  await em.flush()
  return { success: true }
})

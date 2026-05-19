import { z } from 'zod'
import { wrap } from '@mikro-orm/core'

const updateUserSchema = z.object({
  role: z.enum(['admin', 'user'])
})

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid user id' })
  }

  if (id === 1) {
    throw createError({
      statusCode: 400,
      message: 'Cannot change primary admin'
    })
  }

  const body = await readBody(event)
  const data = updateUserSchema.parse(body)
  const em = useEm(event)

  const user = await em.findOne('User', { id })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  wrap(user).assign({ role: data.role })
  await em.flush()

  return {
    id: (user as any).id,
    username: (user as any).username,
    role: (user as any).role,
    createdAt: (user as any).createdAt,
  }
})

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDatabase, schema } from '../../../database'

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
  const db = await getDatabase()

  const result = await db
    .update(schema.users)
    .set({ role: data.role })
    .where(eq(schema.users.id, id))
    .returning({
      id: schema.users.id,
      username: schema.users.username,
      role: schema.users.role,
      createdAt: schema.users.createdAt
    })

  if (!result.length) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return result[0]
})

import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid user id' })
  }

  if (id === 1) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete the primary admin'
    })
  }

  const db = await getDatabase()
  await db.delete(schema.users).where(eq(schema.users.id, id))

  return { success: true }
})

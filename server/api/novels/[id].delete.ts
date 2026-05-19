import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id')!)

  const db = await getDatabase()
  const result = await (db as any)
    .update(schema.novels)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.novels.id, id), eq(schema.novels.userId, auth.userId)))
    .returning()

  if (!result.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  return { success: true }
})

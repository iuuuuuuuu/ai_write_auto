import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const chapterId = parseInt(getRouterParam(event, 'chapterId')!)

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.id, novelId), eq(schema.novels.userId, auth.userId)))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  await (db as any)
    .update(schema.chapters)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.chapters.id, chapterId), eq(schema.chapters.novelId, novelId)))

  return { success: true }
})

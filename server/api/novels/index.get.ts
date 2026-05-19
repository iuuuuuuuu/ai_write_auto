import { eq, isNull, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.userId, auth.userId), isNull(schema.novels.deletedAt)))
    .orderBy(schema.novels.updatedAt)

  return novels
})

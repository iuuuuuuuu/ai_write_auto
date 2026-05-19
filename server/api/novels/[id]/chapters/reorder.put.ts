import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const { orderedIds } = reorderSchema.parse(body)

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.id, novelId), eq(schema.novels.userId, auth.userId)))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const chapterId = orderedIds[i]!
    await (db as any)
      .update(schema.chapters)
      .set({ chapterNumber: i + 1, updatedAt: new Date() })
      .where(
        and(
          eq(schema.chapters.id, chapterId),
          eq(schema.chapters.novelId, novelId)
        )
      )
  }

  return { success: true }
})

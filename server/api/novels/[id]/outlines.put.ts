import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'

const outlineSchema = z.object({
  outlines: z.array(z.object({
    chapterNumber: z.number().int().positive(),
    description: z.string().min(1),
    sortOrder: z.number().int(),
  })),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = outlineSchema.parse(body)

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
    .delete(schema.novelOutlines)
    .where(eq(schema.novelOutlines.novelId, novelId))

  if (data.outlines.length > 0) {
    await (db as any).insert(schema.novelOutlines).values(
      data.outlines.map(o => ({
        novelId,
        chapterNumber: o.chapterNumber,
        description: o.description,
        sortOrder: o.sortOrder,
      }))
    )
  }

  return { success: true }
})

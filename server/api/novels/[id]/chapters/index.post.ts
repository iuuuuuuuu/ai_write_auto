import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'

const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  chapterNumber: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = createChapterSchema.parse(body)

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.id, novelId), eq(schema.novels.userId, auth.userId)))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  let chapterNumber = data.chapterNumber
  if (!chapterNumber) {
    const existing = await (db as any)
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.novelId, novelId))
      .orderBy(schema.chapters.chapterNumber)
    chapterNumber = existing.length + 1
  }

  const wordCount = data.content ? data.content.replace(/\s/g, '').length : 0

  const result = await (db as any).insert(schema.chapters).values({
    novelId,
    chapterNumber,
    title: data.title,
    content: data.content || null,
    status: 'draft',
    wordCount,
  }).returning()

  return result[0]
})

import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  status: z.enum(['draft', 'generated', 'edited', 'final']).optional(),
  chapterNumber: z.number().int().positive().optional(),
  expectedUpdatedAt: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const chapterId = parseInt(getRouterParam(event, 'chapterId')!)
  const body = await readBody(event)
  const data = updateChapterSchema.parse(body)

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.id, novelId), eq(schema.novels.userId, auth.userId)))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  if (data.expectedUpdatedAt) {
    const current = await (db as any)
      .select({ updatedAt: schema.chapters.updatedAt })
      .from(schema.chapters)
      .where(and(eq(schema.chapters.id, chapterId), eq(schema.chapters.novelId, novelId)))
      .limit(1)

    if (current.length && current[0].updatedAt) {
      const serverTime = new Date(current[0].updatedAt).getTime()
      const clientTime = new Date(data.expectedUpdatedAt).getTime()
      if (serverTime > clientTime) {
        throw createError({ statusCode: 409, message: 'Conflict: chapter was modified in another tab' })
      }
    }
  }

  const { expectedUpdatedAt, ...updateData } = data
  const updates: any = { ...updateData, updatedAt: new Date() }
  if (data.content !== undefined) {
    updates.wordCount = data.content.replace(/\s/g, '').length
  }

  const result = await (db as any)
    .update(schema.chapters)
    .set(updates)
    .where(and(eq(schema.chapters.id, chapterId), eq(schema.chapters.novelId, novelId)))
    .returning()

  if (!result.length) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }

  if (data.content !== undefined) {
    const versions = await (db as any)
      .select()
      .from(schema.chapterVersions)
      .where(eq(schema.chapterVersions.chapterId, chapterId))
      .orderBy(schema.chapterVersions.versionNumber)

    await (db as any).insert(schema.chapterVersions).values({
      chapterId,
      versionNumber: versions.length + 1,
      content: data.content,
      source: 'user_edited',
    })
  }

  return result[0]
})

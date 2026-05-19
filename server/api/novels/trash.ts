import { eq, and, isNotNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const db = await getDatabase()

  if (method === 'GET') {
    const deletedNovels = await (db as any)
      .select()
      .from(schema.novels)
      .where(and(eq(schema.novels.userId, auth.userId), isNotNull(schema.novels.deletedAt)))

    const deletedChapters = await (db as any)
      .select({
        id: schema.chapters.id,
        title: schema.chapters.title,
        chapterNumber: schema.chapters.chapterNumber,
        novelId: schema.chapters.novelId,
        deletedAt: schema.chapters.deletedAt,
        wordCount: schema.chapters.wordCount,
      })
      .from(schema.chapters)
      .innerJoin(schema.novels, eq(schema.chapters.novelId, schema.novels.id))
      .where(and(eq(schema.novels.userId, auth.userId), isNotNull(schema.chapters.deletedAt)))

    return { novels: deletedNovels, chapters: deletedChapters }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { type, id } = body

    if (type === 'novel') {
      const result = await (db as any)
        .update(schema.novels)
        .set({ deletedAt: null })
        .where(and(eq(schema.novels.id, id), eq(schema.novels.userId, auth.userId)))
        .returning()

      if (!result.length) throw createError({ statusCode: 404, message: 'Not found' })
      return result[0]
    }

    if (type === 'chapter') {
      const chapters = await (db as any)
        .select({ novelId: schema.chapters.novelId })
        .from(schema.chapters)
        .where(eq(schema.chapters.id, id))
        .limit(1)

      if (!chapters.length) throw createError({ statusCode: 404, message: 'Not found' })

      const novels = await (db as any)
        .select()
        .from(schema.novels)
        .where(and(eq(schema.novels.id, chapters[0].novelId), eq(schema.novels.userId, auth.userId)))
        .limit(1)

      if (!novels.length) throw createError({ statusCode: 403, message: 'Forbidden' })

      const result = await (db as any)
        .update(schema.chapters)
        .set({ deletedAt: null })
        .where(eq(schema.chapters.id, id))
        .returning()

      return result[0]
    }

    throw createError({ statusCode: 400, message: 'Invalid type' })
  }
})

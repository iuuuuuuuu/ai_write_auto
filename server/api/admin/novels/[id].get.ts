import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid novel id' })
  }

  const db = await getDatabase()
  const novels = await db
    .select()
    .from(schema.novels)
    .where(eq(schema.novels.id, id))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const novel = novels[0]
  const [owners, chapters, outlines, characters, plotPoints] =
    await Promise.all([
      db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          role: schema.users.role
        })
        .from(schema.users)
        .where(eq(schema.users.id, novel.userId))
        .limit(1),
      db.select().from(schema.chapters).where(eq(schema.chapters.novelId, id)),
      db
        .select()
        .from(schema.novelOutlines)
        .where(eq(schema.novelOutlines.novelId, id)),
      db
        .select()
        .from(schema.characters)
        .where(eq(schema.characters.novelId, id)),
      db
        .select()
        .from(schema.plotPoints)
        .where(eq(schema.plotPoints.novelId, id))
    ])

  const activeChapters = chapters.filter(
    (chapter) => chapter.deletedAt === null
  )
  const wordCount = activeChapters.reduce(
    (sum, chapter) => sum + (chapter.wordCount || 0),
    0
  )

  return {
    novel: {
      ...novel,
      user: owners[0] || null,
      chapterCount: activeChapters.length,
      wordCount
    },
    chapters: activeChapters,
    outlines,
    characters,
    plotPoints
  }
})

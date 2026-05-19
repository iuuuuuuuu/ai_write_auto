import { getDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = await getDatabase()

  const [novels, users, chapters] = await Promise.all([
    db.select().from(schema.novels),
    db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role
      })
      .from(schema.users),
    db
      .select({
        id: schema.chapters.id,
        novelId: schema.chapters.novelId,
        wordCount: schema.chapters.wordCount,
        deletedAt: schema.chapters.deletedAt
      })
      .from(schema.chapters)
  ])

  const usersById = new Map(users.map((user) => [user.id, user]))

  return novels.map((novel) => {
    const novelChapters = chapters.filter(
      (chapter) => chapter.novelId === novel.id && chapter.deletedAt === null
    )
    const wordCount = novelChapters.reduce(
      (sum, chapter) => sum + (chapter.wordCount || 0),
      0
    )

    return {
      ...novel,
      user: usersById.get(novel.userId) || null,
      chapterCount: novelChapters.length,
      wordCount
    }
  })
})

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)

  const [novels, users, chapters] = await Promise.all([
    em.find('Novel', {}),
    em.find('User', {}),
    em.find('Chapter', {}),
  ])

  const usersById = new Map(users.map((user: any) => [user.id, { id: user.id, username: user.username, role: user.role }]))

  return novels.map((novel: any) => {
    const novelChapters = chapters.filter(
      (chapter: any) => chapter.novel === novel.id && chapter.deletedAt === null
    )
    const wordCount = novelChapters.reduce(
      (sum: number, chapter: any) => sum + (chapter.wordCount || 0),
      0
    )

    return {
      ...novel,
      user: usersById.get(novel.user) || null,
      chapterCount: novelChapters.length,
      wordCount
    }
  })
})

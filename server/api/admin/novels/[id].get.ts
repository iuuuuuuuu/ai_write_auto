export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid novel id' })
  }

  const em = useEm(event)
  const novel = await em.findOne('Novel', { id })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const [owners, chapters, outlines, characters, plotPoints] = await Promise.all([
    em.find('User', { id: (novel as any).user }, { limit: 1 }),
    em.find('Chapter', { novel: id }),
    em.find('NovelOutline', { novel: id }),
    em.find('Character', { novel: id }),
    em.find('PlotPoint', { novel: id }),
  ])

  const activeChapters = chapters.filter(
    (chapter: any) => chapter.deletedAt === null
  )
  const wordCount = activeChapters.reduce(
    (sum: number, chapter: any) => sum + (chapter.wordCount || 0),
    0
  )

  const owner = owners[0]

  return {
    novel: {
      ...(novel as any),
      user: owner ? { id: (owner as any).id, username: (owner as any).username, role: (owner as any).role } : null,
      chapterCount: activeChapters.length,
      wordCount
    },
    chapters: activeChapters,
    outlines,
    characters,
    plotPoints
  }
})

import { NovelSchema, UserSchema, ChapterSchema, NovelOutlineSchema, CharacterSchema, PlotPointSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid novel id' })
  }

  const em = useEm(event)
  const novel = await em.findOne(NovelSchema, { id })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const [owners, chapters, outlines, characters, plotPoints] = await Promise.all([
    em.find(UserSchema, { id: novel.user as any }, { limit: 1 }),
    em.find(ChapterSchema, { novel: id }),
    em.find(NovelOutlineSchema, { novel: id }),
    em.find(CharacterSchema, { novel: id }),
    em.find(PlotPointSchema, { novel: id }),
  ])

  const activeChapters = chapters.filter(
    (chapter) => chapter.deletedAt === null
  )
  const wordCount = activeChapters.reduce(
    (sum, chapter) => sum + (chapter.wordCount || 0),
    0
  )

  const owner = owners[0]

  return {
    novel: {
      ...novel,
      user: owner ? { id: owner.id, username: owner.username, role: owner.role } : null,
      chapterCount: activeChapters.length,
      wordCount
    },
    chapters: activeChapters,
    outlines,
    characters,
    plotPoints
  }
})

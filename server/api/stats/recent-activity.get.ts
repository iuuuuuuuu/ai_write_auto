import { ChapterSchema, NovelSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)

  const recentChapters = await em.find(
    ChapterSchema,
    {
      novel: { user: auth.userId, deletedAt: null },
      deletedAt: null
    },
    {
      limit: 5,
      orderBy: { updatedAt: 'DESC' },
      populate: ['novel']
    }
  )

  return recentChapters.map((chapter: any) => ({
    id: chapter.id,
    title: chapter.title,
    chapterNumber: chapter.chapterNumber,
    novelId: chapter.novel?.id || chapter.novel,
    novelTitle: chapter.novel?.title || '',
    updatedAt: chapter.updatedAt,
    wordCount: chapter.wordCount
  }))
})

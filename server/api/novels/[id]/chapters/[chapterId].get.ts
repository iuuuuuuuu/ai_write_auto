import { NovelSchema, ChapterSchema } from '../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId,
    deletedAt: null
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(
    ChapterSchema,
    { id: chapterId, novel: novelId, deletedAt: null },
    {
      fields: [
        'id',
        'chapterNumber',
        'title',
        'content',
        'summary',
        'status',
        'wordCount',
        'updatedAt',
        'createdAt'
      ]
    }
  )
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })

  return {
    id: chapter.id,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    content: chapter.content,
    summary: chapter.summary,
    status: chapter.status,
    wordCount: chapter.wordCount,
    updatedAt: chapter.updatedAt,
    createdAt: chapter.createdAt
  }
})

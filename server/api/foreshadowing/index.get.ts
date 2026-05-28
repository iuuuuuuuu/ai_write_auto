import { ForeshadowingSchema, NovelSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const novelId = Number(query.novelId)

  if (!novelId) throw createError({ statusCode: 400, message: 'novelId is required' })

  const em = useEm(event)
  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const items = await em.find(ForeshadowingSchema, { novel: novelId }, {
    populate: ['chapter'],
    orderBy: { createdAt: 'DESC' }
  })

  return items.map(f => ({
    id: f.id,
    content: f.content,
    description: f.description,
    status: f.status,
    chapterId: f.chapter ? (f.chapter as any).id : null,
    chapterNumber: f.chapter ? (f.chapter as any).chapterNumber : null,
    resolvedAtChapter: f.resolvedAtChapter,
    createdAt: f.createdAt
  }))
})

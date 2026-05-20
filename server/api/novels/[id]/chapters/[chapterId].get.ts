import { NovelSchema, ChapterSchema } from '../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = Number(getRouterParam(event, 'id'))
  const chapterId = Number(getRouterParam(event, 'chapterId'))
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId, deletedAt: null })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(ChapterSchema, { id: chapterId, novel: novelId, deletedAt: null })
  if (!chapter) throw createError({ statusCode: 404, message: 'Chapter not found' })

  return chapter
})

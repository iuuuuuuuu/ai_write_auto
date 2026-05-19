export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = Number(getRouterParam(event, 'id'))
  const chapterId = Number(getRouterParam(event, 'chapterId'))
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: novelId, user: auth.userId, deletedAt: null })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne('Chapter', { id: chapterId, novel: novelId, deletedAt: null })
  if (!chapter) throw createError({ statusCode: 404, message: 'Chapter not found' })

  return chapter
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = Number(getRouterParam(event, 'id'))
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: novelId, user: auth.userId, deletedAt: null })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapters = await em.find('Chapter', { novel: novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' } })

  return chapters
})

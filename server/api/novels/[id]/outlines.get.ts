export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const outlines = await em.find('NovelOutline', { novel: novelId }, { orderBy: { sortOrder: 'ASC' } })
  return outlines
})

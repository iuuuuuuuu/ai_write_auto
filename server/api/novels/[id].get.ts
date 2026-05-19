export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id')!)
  const em = useEm(event)

  const novel = await em.findOne('Novel', {
    id,
    user: auth.userId,
    deletedAt: null,
  })

  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  return novel
})

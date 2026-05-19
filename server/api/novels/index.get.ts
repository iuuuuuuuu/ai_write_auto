export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)

  const novels = await em.find('Novel', {
    user: auth.userId,
    deletedAt: null,
  }, {
    orderBy: { updatedAt: 'DESC' },
  })

  return novels
})

import { NovelSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseIntParam(event, 'id')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id,
    user: auth.userId,
    deletedAt: null,
  })

  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  novel.deletedAt = new Date()
  await em.flush()

  return { success: true }
})

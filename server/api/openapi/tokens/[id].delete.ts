import { ApiTokenSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const id = Number(event.context.params?.id)

  if (!id || !Number.isFinite(id)) {
    throw createError({ statusCode: 400, message: 'Invalid token ID' })
  }

  const token = await em.findOne(ApiTokenSchema, { id, user: auth.userId })
  if (!token) {
    throw createError({ statusCode: 404, message: 'Token not found' })
  }

  await em.removeAndFlush(token)
  return { success: true }
})

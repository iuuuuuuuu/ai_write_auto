import { UserSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid user id' })
  }

  if (id === 1) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete the primary admin'
    })
  }

  const em = useEm(event)
  await em.nativeDelete(UserSchema, { id })

  return { success: true }
})

import { z } from 'zod'
import { hashPassword } from '../../../../utils/auth'
import { UserSchema } from '../../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseIntParam(event, 'id')

  const body = await readBody(event)
  const data = z.object({
    newPassword: z.string().min(6),
  }).parse(body)

  const user = await em.findOne(UserSchema, { id })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  user.passwordHash = hashPassword(data.newPassword)
  await em.flush()

  return { success: true }
})

import { z } from 'zod'
import { verifyPassword, signToken } from '../../utils/auth'
import { UserSchema } from '../../database/entities'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = loginSchema.parse(body)

  const em = useEm(event)
  const user = await em.findOne(UserSchema, { username })

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  })

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    token,
  }
})

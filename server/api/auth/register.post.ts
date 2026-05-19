import { z } from 'zod'
import { hashPassword, signToken } from '../../utils/auth'

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
})

export default defineEventHandler(async (event) => {
  const em = useEm(event)

  const allowRegConfig = await em.findOne('SiteConfig', { key: 'allow_registration' })
  if (!allowRegConfig || allowRegConfig.value !== 'true') {
    throw createError({ statusCode: 403, message: 'Registration is disabled' })
  }

  const body = await readBody(event)
  const { username, password } = registerSchema.parse(body)

  const existing = await em.findOne('User', { username })
  if (existing) {
    throw createError({ statusCode: 409, message: 'Username already exists' })
  }

  const passwordHash = hashPassword(password)
  const user = em.create('User', {
    username,
    passwordHash,
    role: 'user',
  })
  await em.flush()

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  })

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
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
  }
})

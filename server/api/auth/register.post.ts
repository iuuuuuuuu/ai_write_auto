import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { hashPassword, signToken } from '../../utils/auth'

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
})

export default defineEventHandler(async (event) => {
  const db = await getDatabase()

  const siteConfigs = await (db as any).select().from(schema.siteConfig).where(eq(schema.siteConfig.key, 'allow_registration'))
  const allowReg = siteConfigs[0]?.value === 'true'

  if (!allowReg) {
    throw createError({ statusCode: 403, message: 'Registration is disabled' })
  }

  const body = await readBody(event)
  const { username, password } = registerSchema.parse(body)

  const existing = await (db as any).select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (existing.length > 0) {
    throw createError({ statusCode: 409, message: 'Username already exists' })
  }

  const passwordHash = hashPassword(password)
  const result = await (db as any).insert(schema.users).values({
    username,
    passwordHash,
    role: 'user',
  }).returning()

  const user = result[0]
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

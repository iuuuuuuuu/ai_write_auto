import { z } from 'zod'
import { writeDbConfig, type DbConfig } from '../../database/db-config'
import { initOrm, getOrm, testConnection, resetOrm } from '../../database'
import { hashPassword, signToken } from '../../utils/auth'
import { UserSchema, SiteConfigSchema } from '../../database/entities'

const setupSchema = z.object({
  database: z.object({
    type: z.enum(['sqlite', 'mysql']),
    sqlite: z.object({
      path: z.string().min(1),
    }).optional(),
    mysql: z.object({
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535),
      user: z.string().min(1),
      password: z.string(),
      database: z.string().min(1),
    }).optional(),
  }),
  admin: z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(6),
  }),
  site: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  }),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = setupSchema.parse(body)

  const dbConfig: DbConfig = {
    type: data.database.type,
    sqlite: data.database.sqlite,
    mysql: data.database.mysql,
  }

  if (dbConfig.type === 'sqlite' && !dbConfig.sqlite) {
    dbConfig.sqlite = { path: './data/novel.db' }
  }

  const connTest = await testConnection(dbConfig)
  if (!connTest.success) {
    throw createError({ statusCode: 400, message: `Database connection failed: ${connTest.error}` })
  }

  resetOrm()
  await initOrm(dbConfig)

  const generator = getOrm().getSchemaGenerator()
  await generator.updateSchema({ safe: true, dropTables: false })

  writeDbConfig(dbConfig)

  const em = getOrm().em.fork()

  const passwordHash = hashPassword(data.admin.password)
  em.create(UserSchema, {
    username: data.admin.username,
    passwordHash,
    role: 'admin',
  })

  em.create(SiteConfigSchema, { key: 'site_name', value: data.site.name })
  em.create(SiteConfigSchema, { key: 'site_description', value: data.site.description || '' })
  em.create(SiteConfigSchema, { key: 'allow_registration', value: 'false' })
  em.create(SiteConfigSchema, { key: 'initialized', value: 'true' })

  await em.flush()

  const token = signToken({
    userId: 1,
    username: data.admin.username,
    role: 'admin',
  })

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return { success: true }
})

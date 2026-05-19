import { testConnection } from '../../database'
import { type DbConfig } from '../../database/db-config'
import { z } from 'zod'

const testDbSchema = z.object({
  type: z.enum(['sqlite', 'mysql']),
  sqlite: z.object({ path: z.string().min(1) }).optional(),
  mysql: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    user: z.string().min(1),
    password: z.string(),
    database: z.string().min(1),
  }).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = testDbSchema.parse(body) as DbConfig
  return testConnection(config)
})

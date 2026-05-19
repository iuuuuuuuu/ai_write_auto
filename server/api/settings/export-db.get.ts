import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readDbConfig } from '../../database/db-config'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const config = readDbConfig()
  if (!config || config.type !== 'sqlite') {
    throw createError({ statusCode: 400, message: 'Export only available for SQLite databases' })
  }

  const dbPath = resolve(process.cwd(), config.sqlite?.path || './data/novel.db')
  if (!existsSync(dbPath)) {
    throw createError({ statusCode: 404, message: 'Database file not found' })
  }

  setResponseHeaders(event, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="novel-backup-${Date.now()}.db"`,
  })

  return createReadStream(dbPath)
})

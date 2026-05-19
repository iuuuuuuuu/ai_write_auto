import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { readDbConfig } from '../../database/db-config'

const BACKUP_DIR = resolve(process.cwd(), 'data/backups')
const MAX_BACKUPS = 7

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

function getBackupList(): Array<{ name: string; size: number; createdAt: string }> {
  ensureBackupDir()
  const files = readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'))
  return files.map(name => {
    const stat = statSync(join(BACKUP_DIR, name))
    return { name, size: stat.size, createdAt: stat.birthtime.toISOString() }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function cleanOldBackups() {
  const backups = getBackupList()
  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS)
    for (const b of toDelete) {
      unlinkSync(join(BACKUP_DIR, b.name))
    }
  }
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const method = getMethod(event)

  if (method === 'GET') {
    return { backups: getBackupList() }
  }

  if (method === 'POST') {
    const config = readDbConfig()
    if (!config || config.type !== 'sqlite') {
      throw createError({ statusCode: 400, message: 'Backup only available for SQLite' })
    }

    const dbPath = resolve(process.cwd(), config.sqlite?.path || './data/novel.db')
    if (!existsSync(dbPath)) {
      throw createError({ statusCode: 404, message: 'Database file not found' })
    }

    ensureBackupDir()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupName = `backup-${timestamp}.db`
    copyFileSync(dbPath, join(BACKUP_DIR, backupName))
    cleanOldBackups()

    return { success: true, name: backupName }
  }
})

import { copyFileSync } from 'node:fs'
import { z } from 'zod'
import { closeOrm, getOrm, initOrm } from '../../database'
import { readDbConfig } from '../../database/db-config'
import { syncDatabaseSchema } from '../../database/schema-sync'
import {
  createCurrentDatabaseBackup,
  createSqliteBackup,
  getBackupList,
  getSqliteDbPath,
  readBackupSettings,
  resolveBackupPath,
  restoreMysqlBackup,
  startScheduledBackup,
  stopScheduledBackup,
  triggerScheduledBackupNow,
  writeBackupSettings,
  type BackupItem,
  type BackupSettings
} from '../../services/database-backup'

const restoreSchema = z.object({
  name: z.string().min(1)
})

const settingsSchema = z.object({
  maxBackups: z.number().int().min(1).max(30),
  autoBackupOnStartup: z.boolean(),
  scheduleEnabled: z.boolean(),
  scheduleCron: z.string().min(1)
})

interface BackupResponse {
  backups: BackupItem[]
  settings: BackupSettings
}

interface CreateBackupResponse {
  success: boolean
  name: string
}

interface RestoreBackupResponse {
  success: boolean
  restoredFrom: string
  safetyBackup: string | null
  error?: string
  currentState?: string
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const method = getMethod(event)

  if (method === 'GET') {
    const settings = await readBackupSettings(getOrm())

    return { backups: getBackupList(), settings } satisfies BackupResponse
  }

  if (method === 'POST') {
    const settings = await readBackupSettings(getOrm())
    const backupName = await createCurrentDatabaseBackup(getOrm(), {
      maxBackups: settings.maxBackups
    })

    return { success: true, name: backupName } satisfies CreateBackupResponse
  }

  if (method === 'PATCH') {
    const body = await readBody(event)
    const data = settingsSchema.parse(body)
    const settings = await writeBackupSettings(getOrm(), data)

    // 重新加载定时任务
    const orm = getOrm()
    stopScheduledBackup()
    startScheduledBackup(orm)

    return { success: true, settings }
  }

  if (method === 'DELETE') {
    const backupName = await triggerScheduledBackupNow(getOrm())
    return { success: true, name: backupName } satisfies CreateBackupResponse
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const data = restoreSchema.parse(body)

    try {
      if (data.name.endsWith('.mysql.json')) {
        const settings = await readBackupSettings(getOrm())
        let safetyBackup: string | null = null
        try {
          safetyBackup = await createCurrentDatabaseBackup(getOrm(), {
            prefix: 'pre-restore',
            maxBackups: settings.maxBackups
          })
        } catch (sbErr: any) {
          console.warn('[backup] Pre-restore safety backup failed:', sbErr)
        }

        await restoreMysqlBackup(getOrm(), data.name)
        const orm = getOrm()
        await syncDatabaseSchema(orm, 'backup-restore')

        return {
          success: true,
          restoredFrom: data.name,
          safetyBackup,
          currentState: 'mysql'
        } satisfies RestoreBackupResponse
      }

      const { config, dbPath } = getSqliteDbPath()
      const backupPath = resolveBackupPath(data.name)
      const settings = await readBackupSettings(getOrm())

      let safetyBackup: string | null = null
      try {
        safetyBackup = createSqliteBackup({
          prefix: 'pre-restore',
          maxBackups: settings.maxBackups
        })
      } catch (sbErr: any) {
        console.warn('[backup] Pre-restore safety backup failed:', sbErr)
      }

      await closeOrm()
      copyFileSync(backupPath, dbPath)
      const orm = await initOrm(config)
      await syncDatabaseSchema(orm, 'backup-restore')

      return {
        success: true,
        restoredFrom: data.name,
        safetyBackup,
        currentState: 'sqlite'
      } satisfies RestoreBackupResponse
    } catch (err: any) {
      return {
        success: false,
        restoredFrom: data.name,
        safetyBackup: null,
        error: err?.message || '恢复过程中发生未知错误',
        currentState: readDbConfig()?.type || 'unknown'
      } satisfies RestoreBackupResponse
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

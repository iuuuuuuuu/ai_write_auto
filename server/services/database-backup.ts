import {
  copyFileSync,
  existsSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { type MikroORM } from '@mikro-orm/core'
import { Cron } from 'croner'
import { SiteConfigSchema } from '../database/entities'
import { readDbConfig } from '../database/db-config'
import { MIGRATION_TABLES } from '../database/migration-plan'

const BACKUP_DIR = resolve(process.cwd(), 'data/backups')
const DEFAULT_MAX_BACKUPS = 7
const MIN_MAX_BACKUPS = 1
const MAX_MAX_BACKUPS = 30

export interface BackupItem {
  name: string
  type: 'sqlite' | 'mysql'
  size: number
  createdAt: string
}

export interface BackupSettings {
  maxBackups: number
  autoBackupOnStartup: boolean
  scheduleEnabled: boolean
  scheduleCron: string
  lastRunAt: string | null
  lastRunSuccess: boolean | null
  lastRunError: string | null
}

export interface CreateSqliteBackupOptions {
  prefix?: string
  maxBackups?: number
}

interface MysqlLogicalBackup {
  type: 'mysql'
  createdAt: string
  tables: Array<{
    tableName: string
    rows: Array<Record<string, unknown>>
  }>
}

export function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

export function normalizeBackupSettings(settings: Partial<BackupSettings>) {
  const maxBackups = Math.min(
    MAX_MAX_BACKUPS,
    Math.max(
      MIN_MAX_BACKUPS,
      Number.isFinite(settings.maxBackups) ?
        settings.maxBackups!
      : DEFAULT_MAX_BACKUPS
    )
  )

  const defaultCron = '0 2 * * *'
  const cron = settings.scheduleCron || defaultCron

  return {
    maxBackups,
    autoBackupOnStartup: Boolean(settings.autoBackupOnStartup),
    scheduleEnabled: Boolean(settings.scheduleEnabled),
    scheduleCron: cron,
    lastRunAt: settings.lastRunAt || null,
    lastRunSuccess: settings.lastRunSuccess ?? null,
    lastRunError: settings.lastRunError || null
  } satisfies BackupSettings
}

export function getBackupList(): BackupItem[] {
  ensureBackupDir()
  const files = readdirSync(BACKUP_DIR).filter(
    (file) => file.endsWith('.db') || file.endsWith('.mysql.json')
  )
  return files
    .map((name) => {
      const stat = statSync(join(BACKUP_DIR, name))
      return {
        name,
        type: name.endsWith('.mysql.json') ? 'mysql' : 'sqlite',
        size: stat.size,
        createdAt: stat.birthtime.toISOString()
      } satisfies BackupItem
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getSqliteDbPath() {
  const config = readDbConfig()
  if (!config || config.type !== 'sqlite') {
    throw createError({
      statusCode: 400,
      message: 'Backup only available for SQLite'
    })
  }

  const dbPath = resolve(
    process.cwd(),
    config.sqlite?.path || './data/novel.db'
  )
  if (!existsSync(dbPath)) {
    throw createError({ statusCode: 404, message: 'Database file not found' })
  }

  return { config, dbPath }
}

export function resolveBackupPath(name: string): string {
  const safeName = basename(name)
  const isSupportedBackup =
    safeName.endsWith('.db') || safeName.endsWith('.mysql.json')
  if (safeName !== name || !isSupportedBackup) {
    throw createError({ statusCode: 400, message: 'Invalid backup name' })
  }

  const backupPath = join(BACKUP_DIR, safeName)
  if (!existsSync(backupPath)) {
    throw createError({ statusCode: 404, message: 'Backup file not found' })
  }

  return backupPath
}

export function cleanOldBackups(maxBackups = DEFAULT_MAX_BACKUPS) {
  const settings = normalizeBackupSettings({ maxBackups })
  const backups = getBackupList()
  if (backups.length > settings.maxBackups) {
    const toDelete = backups.slice(settings.maxBackups)
    for (const backup of toDelete) {
      unlinkSync(join(BACKUP_DIR, backup.name))
    }
  }
}

function getCurrentConfig() {
  const config = readDbConfig()
  if (!config) {
    throw createError({
      statusCode: 400,
      message: 'Database is not configured'
    })
  }

  return config
}

function normalizeLogicalBackupValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLogicalBackupValue(item))
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        normalized[key] = normalizeLogicalBackupValue(record[key])
        return normalized
      }, {})
  }

  return value
}

function quoteTableName(tableName: string): string {
  return `\`${tableName}\``
}

async function readTableRows(
  orm: MikroORM,
  tableName: string
): Promise<Array<Record<string, unknown>>> {
  const result = await orm.em
    .getConnection()
    .execute(`SELECT * FROM ${quoteTableName(tableName)}`)

  if (!Array.isArray(result)) return []
  return result
    .filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === 'object')
    )
    .map((row) => normalizeLogicalBackupValue(row) as Record<string, unknown>)
}

async function clearTableRows(orm: MikroORM, tableName: string): Promise<void> {
  await orm.em
    .getConnection()
    .execute(`DELETE FROM ${quoteTableName(tableName)}`)
}

export function createSqliteBackup(
  options: CreateSqliteBackupOptions = {}
): string {
  const { dbPath } = getSqliteDbPath()
  ensureBackupDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupName = `${options.prefix || 'backup'}-${timestamp}.db`
  copyFileSync(dbPath, join(BACKUP_DIR, backupName))
  cleanOldBackups(options.maxBackups)

  return backupName
}

export async function createMysqlBackup(
  orm: MikroORM,
  options: CreateSqliteBackupOptions = {}
): Promise<string> {
  const config = getCurrentConfig()
  if (config.type !== 'mysql') {
    throw createError({
      statusCode: 400,
      message: 'MySQL backup only available for MySQL'
    })
  }

  ensureBackupDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupName = `${options.prefix || 'backup'}-${timestamp}.mysql.json`
  const backup: MysqlLogicalBackup = {
    type: 'mysql',
    createdAt: new Date().toISOString(),
    tables: await Promise.all(
      MIGRATION_TABLES.map(async (table) => ({
        tableName: table.tableName,
        rows: await readTableRows(orm, table.tableName)
      }))
    )
  }

  writeFileSync(join(BACKUP_DIR, backupName), JSON.stringify(backup, null, 2))
  cleanOldBackups(options.maxBackups)

  return backupName
}

export async function createCurrentDatabaseBackup(
  orm: MikroORM,
  options: CreateSqliteBackupOptions = {}
): Promise<string> {
  const config = getCurrentConfig()
  if (config.type === 'mysql') {
    return createMysqlBackup(orm, options)
  }

  return createSqliteBackup(options)
}

export async function restoreMysqlBackup(
  orm: MikroORM,
  name: string
): Promise<void> {
  const config = getCurrentConfig()
  if (config.type !== 'mysql') {
    throw createError({
      statusCode: 400,
      message: 'MySQL restore only available for MySQL'
    })
  }

  const backupPath = resolveBackupPath(name)
  if (!backupPath.endsWith('.mysql.json')) {
    throw createError({ statusCode: 400, message: 'Invalid MySQL backup file' })
  }

  const backup = JSON.parse(
    readFileSync(backupPath, 'utf8')
  ) as MysqlLogicalBackup
  if (backup.type !== 'mysql' || !Array.isArray(backup.tables)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid MySQL backup content'
    })
  }

  const connection = orm.em.getConnection() as any
  await connection.execute('SET FOREIGN_KEY_CHECKS=0')
  try {
    for (const table of [...MIGRATION_TABLES].reverse()) {
      await clearTableRows(orm, table.tableName)
    }

    for (const table of MIGRATION_TABLES) {
      const backupTable = backup.tables.find(
        (item) => item.tableName === table.tableName
      )
      const rows = backupTable?.rows || []
      for (const row of rows) {
        await connection.insert(table.tableName, row)
      }
    }
  } finally {
    await connection.execute('SET FOREIGN_KEY_CHECKS=1')
  }
}

export async function readBackupSettings(
  orm: MikroORM
): Promise<BackupSettings> {
  const em = orm.em.fork()
  const rows = await em.find(SiteConfigSchema, {
    key: {
      $in: [
        'backup_max_count',
        'backup_auto_on_startup',
        'backup_schedule_enabled',
        'backup_schedule_cron',
        'backup_last_run_at',
        'backup_last_run_success',
        'backup_last_run_error'
      ]
    }
  })
  const values = new Map(rows.map((row) => [row.key, row.value]))

  return normalizeBackupSettings({
    maxBackups: Number(values.get('backup_max_count') || DEFAULT_MAX_BACKUPS),
    autoBackupOnStartup: values.get('backup_auto_on_startup') === 'true',
    scheduleEnabled: values.get('backup_schedule_enabled') === 'true',
    scheduleCron: values.get('backup_schedule_cron') || undefined,
    lastRunAt: values.get('backup_last_run_at') || undefined,
    lastRunSuccess:
      values.get('backup_last_run_success') === 'true' ? true
      : values.get('backup_last_run_success') === 'false' ? false
      : undefined,
    lastRunError: values.get('backup_last_run_error') || undefined
  })
}

export async function writeBackupSettings(
  orm: MikroORM,
  settings: Partial<BackupSettings>
): Promise<BackupSettings> {
  const normalized = normalizeBackupSettings(settings)
  const em = orm.em.fork()
  const entries = [
    ['backup_max_count', String(normalized.maxBackups)],
    ['backup_auto_on_startup', String(normalized.autoBackupOnStartup)],
    ['backup_schedule_enabled', String(normalized.scheduleEnabled)],
    ['backup_schedule_cron', normalized.scheduleCron],
    ['backup_last_run_at', normalized.lastRunAt || ''],
    [
      'backup_last_run_success',
      normalized.lastRunSuccess === null ?
        ''
      : String(normalized.lastRunSuccess)
    ],
    ['backup_last_run_error', normalized.lastRunError || '']
  ] as const

  for (const [key, value] of entries) {
    const existing = await em.findOne(SiteConfigSchema, { key })
    if (existing) {
      existing.value = value
    } else {
      em.create(SiteConfigSchema, { key, value })
    }
  }

  await em.flush()
  cleanOldBackups(normalized.maxBackups)

  return normalized
}

export async function createStartupBackupIfEnabled(
  orm: MikroORM
): Promise<string | null> {
  const settings = await readBackupSettings(orm)
  if (!settings.autoBackupOnStartup) return null

  return createSqliteBackup({
    prefix: 'auto-startup',
    maxBackups: settings.maxBackups
  })
}

let scheduledJob: Cron | null = null

export function startScheduledBackup(orm: MikroORM) {
  stopScheduledBackup()

  // 创建一个立即执行一次的异步检查，然后按 cron 执行
  const run = async () => {
    const settings = await readBackupSettings(orm)
    if (!settings.scheduleEnabled) return

    try {
      const backupName = createSqliteBackup({
        prefix: 'scheduled',
        maxBackups: settings.maxBackups
      })
      await writeBackupSettings(orm, {
        ...settings,
        lastRunAt: new Date().toISOString(),
        lastRunSuccess: true,
        lastRunError: null
      })
      console.log(`[backup] Scheduled backup created: ${backupName}`)
    } catch (err: any) {
      await writeBackupSettings(orm, {
        ...settings,
        lastRunAt: new Date().toISOString(),
        lastRunSuccess: false,
        lastRunError: err?.message || String(err)
      })
      console.error('[backup] Scheduled backup failed:', err)
    }
  }

  // 先异步读取设置确定 cron 表达式
  readBackupSettings(orm).then((settings) => {
    if (!settings.scheduleEnabled) return
    const cronExpr = settings.scheduleCron || '0 2 * * *'
    scheduledJob = new Cron(cronExpr, run)
  })
}

export function stopScheduledBackup() {
  if (scheduledJob) {
    scheduledJob.stop()
    scheduledJob = null
  }
}

export async function triggerScheduledBackupNow(
  orm: MikroORM
): Promise<string> {
  const settings = await readBackupSettings(orm)
  const backupName = createSqliteBackup({
    prefix: 'manual',
    maxBackups: settings.maxBackups
  })
  await writeBackupSettings(orm, {
    ...settings,
    lastRunAt: new Date().toISOString(),
    lastRunSuccess: true,
    lastRunError: null
  })
  return backupName
}

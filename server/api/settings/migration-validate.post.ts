import { MikroORM } from '@mikro-orm/core'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { buildOrmConfig, getOrm, testConnection } from '../../database'
import {
  getEffectiveDbConfig,
  readDbConfig,
  type DbConfig
} from '../../database/db-config'
import {
  collectDatabaseMigrationPlan,
  MIGRATION_TABLES,
  type DatabaseMigrationPlan
} from '../../database/migration-plan'

const dbConfigSchema = z.object({
  type: z.enum(['sqlite', 'mysql']),
  sqlite: z
    .object({
      path: z.string().min(1)
    })
    .optional(),
  mysql: z
    .object({
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535),
      user: z.string().min(1),
      password: z.string(),
      database: z.string().min(1)
    })
    .optional()
})

const validateSchema = z.object({
  target: dbConfigSchema
})

interface MigrationValidationTableResult {
  tableName: string
  label: string
  sourceRows: number
  targetRows: number
  sourceHash: string | null
  targetHash: string | null
  sourceAvailable: boolean
  targetAvailable: boolean
  rowCountMatched: boolean
  contentMatched: boolean
  matched: boolean
  error: string | null
}

interface MigrationValidationResponse {
  success: boolean
  source: DatabaseMigrationPlan
  target: DatabaseMigrationPlan | null
  tables: MigrationValidationTableResult[]
  mismatches: MigrationValidationTableResult[]
  error: string | null
}

function normalizeSqlitePath(path: string | undefined): string {
  return (path || './data/novel.db').replace(/\\/g, '/').toLowerCase()
}

function isSameDatabaseConfig(current: DbConfig, target: DbConfig): boolean {
  if (current.type !== target.type) return false

  if (current.type === 'sqlite') {
    return (
      normalizeSqlitePath(current.sqlite?.path) ===
      normalizeSqlitePath(target.sqlite?.path)
    )
  }

  const currentMysql = current.mysql
  const targetMysql = target.mysql
  if (!currentMysql || !targetMysql) return false

  return (
    currentMysql.host.toLowerCase() === targetMysql.host.toLowerCase() &&
    currentMysql.port === targetMysql.port &&
    currentMysql.user === targetMysql.user &&
    currentMysql.database === targetMysql.database
  )
}

function normalizeTargetConfig(config: DbConfig): DbConfig {
  if (config.type === 'sqlite') {
    return {
      type: 'sqlite',
      sqlite: config.sqlite || { path: './data/novel-target.db' }
    }
  }

  return config
}

function quoteTableName(tableName: string): string {
  return `\`${tableName}\``
}

function normalizeHashValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  if (Array.isArray(value)) return value.map((item) => normalizeHashValue(item))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        normalized[key] = normalizeHashValue(record[key])
        return normalized
      }, {})
  }

  return value
}

async function collectTableHash(
  orm: MikroORM,
  tableName: string
): Promise<string | null> {
  const result = await orm.em
    .getConnection()
    .execute(`SELECT * FROM ${quoteTableName(tableName)}`)

  if (!Array.isArray(result)) return null

  const rows = result
    .filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === 'object')
    )
    .map((row) => JSON.stringify(normalizeHashValue(row)))
    .sort()

  const hash = createHash('sha256')
  for (const row of rows) {
    hash.update(row)
    hash.update('\n')
  }

  return hash.digest('hex')
}

async function collectTableHashes(
  orm: MikroORM,
  plan: DatabaseMigrationPlan
): Promise<Map<string, string | null>> {
  const entries = await Promise.all(
    MIGRATION_TABLES.map(async (table) => {
      const tablePlan = plan.tables.find(
        (item) => item.tableName === table.tableName
      )
      if (!tablePlan?.available) return [table.tableName, null] as const

      try {
        return [
          table.tableName,
          await collectTableHash(orm, table.tableName)
        ] as const
      } catch {
        return [table.tableName, null] as const
      }
    })
  )

  return new Map(entries)
}

async function comparePlans(
  sourceOrm: MikroORM,
  targetOrm: MikroORM,
  source: DatabaseMigrationPlan,
  target: DatabaseMigrationPlan
): Promise<MigrationValidationTableResult[]> {
  const [sourceHashes, targetHashes] = await Promise.all([
    collectTableHashes(sourceOrm, source),
    collectTableHashes(targetOrm, target)
  ])

  return source.tables.map((sourceTable) => {
    const targetTable = target.tables.find(
      (table) => table.tableName === sourceTable.tableName
    )
    const targetRows = targetTable?.rows ?? 0
    const targetAvailable = Boolean(targetTable?.available)
    const sourceAvailable = sourceTable.available
    const sourceHash = sourceHashes.get(sourceTable.tableName) || null
    const targetHash = targetHashes.get(sourceTable.tableName) || null
    const rowCountMatched = sourceTable.rows === targetRows
    const contentMatched = Boolean(
      sourceHash && targetHash && sourceHash === targetHash
    )
    const matched =
      sourceAvailable && targetAvailable && rowCountMatched && contentMatched
    const error =
      sourceTable.error ||
      targetTable?.error ||
      (matched ? null
      : rowCountMatched ? 'Content hash mismatch'
      : 'Row count mismatch')

    return {
      tableName: sourceTable.tableName,
      label: sourceTable.label,
      sourceRows: sourceTable.rows,
      targetRows,
      sourceHash,
      targetHash,
      sourceAvailable,
      targetAvailable,
      rowCountMatched,
      contentMatched,
      matched,
      error
    }
  })
}

export default defineEventHandler(
  async (event): Promise<MigrationValidationResponse> => {
    requireAdmin(event)

    const body = await readBody(event)
    const data = validateSchema.parse(body)
    const target = normalizeTargetConfig(data.target as DbConfig)
    const sourceConfig = readDbConfig() || getEffectiveDbConfig()
    const sourceOrm = getOrm()
    const source = await collectDatabaseMigrationPlan(sourceOrm, sourceConfig)

    if (isSameDatabaseConfig(sourceConfig, target)) {
      return {
        success: false,
        source,
        target: null,
        tables: [],
        mismatches: [],
        error: 'Target database is the same as the current database'
      }
    }

    const connection = await testConnection(target)
    if (!connection.success) {
      return {
        success: false,
        source,
        target: null,
        tables: [],
        mismatches: [],
        error: connection.error || 'Target database connection failed'
      }
    }

    let targetOrm: MikroORM | null = null
    try {
      targetOrm = await MikroORM.init(buildOrmConfig(target))
      const targetPlan = await collectDatabaseMigrationPlan(targetOrm, target)
      const tables = await comparePlans(
        sourceOrm,
        targetOrm,
        source,
        targetPlan
      )
      const mismatches = tables.filter((table) => !table.matched)

      return {
        success: mismatches.length === 0,
        source,
        target: targetPlan,
        tables,
        mismatches,
        error:
          mismatches.length ? 'Migration validation found mismatches' : null
      }
    } catch (error: unknown) {
      return {
        success: false,
        source,
        target: null,
        tables: [],
        mismatches: [],
        error:
          error instanceof Error ? error.message : 'Migration validation failed'
      }
    } finally {
      if (targetOrm) {
        await targetOrm.close()
      }
    }
  }
)

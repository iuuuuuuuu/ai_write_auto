import type { MikroORM } from '@mikro-orm/core'
import type { DbConfig } from './db-config'
import {
  MIGRATION_TABLES,
  collectDatabaseMigrationPlan,
  type DatabaseMigrationPlan
} from './migration-plan'
import { syncDatabaseSchema } from './schema-sync'

export interface DatabaseMigrationTableResult {
  tableName: string
  sourceRows: number
  insertedRows: number
  success: boolean
  error: string | null
}

export interface DatabaseMigrationResult {
  success: boolean
  startedAt: string
  completedAt: string
  source: DatabaseMigrationPlan
  targetBefore: DatabaseMigrationPlan
  targetAfter: DatabaseMigrationPlan | null
  tables: DatabaseMigrationTableResult[]
  error: string | null
}

const ALLOWED_NON_EMPTY_TARGET_TABLES = new Set([
  'schema_migrations',
  'site_config'
])

function quoteTableName(tableName: string): string {
  return `\`${tableName}\``
}

function hasBusinessRows(plan: DatabaseMigrationPlan): boolean {
  return plan.tables.some(
    (table) =>
      !ALLOWED_NON_EMPTY_TARGET_TABLES.has(table.tableName) && table.rows > 0
  )
}

function compactError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown migration error'
}

async function readAllRows(
  orm: MikroORM,
  tableName: string
): Promise<Array<Record<string, unknown>>> {
  const result = await orm.em
    .getConnection()
    .execute(`SELECT * FROM ${quoteTableName(tableName)}`)

  if (!Array.isArray(result)) return []
  return result.filter((row): row is Record<string, unknown> =>
    Boolean(row && typeof row === 'object')
  )
}

async function clearAllowedMetadataRows(
  orm: MikroORM,
  tableName: string
): Promise<void> {
  if (!ALLOWED_NON_EMPTY_TARGET_TABLES.has(tableName)) return
  await orm.em
    .getConnection()
    .execute(`DELETE FROM ${quoteTableName(tableName)}`)
}

async function insertRows(
  orm: MikroORM,
  tableName: string,
  rows: Array<Record<string, unknown>>
): Promise<number> {
  if (!rows.length) return 0

  const connection = orm.em.getConnection() as any
  await clearAllowedMetadataRows(orm, tableName)

  for (const row of rows) {
    await connection.insert(tableName, row)
  }

  return rows.length
}

export async function migrateDatabaseRows(
  sourceOrm: MikroORM,
  sourceConfig: DbConfig,
  targetOrm: MikroORM,
  targetConfig: DbConfig
): Promise<DatabaseMigrationResult> {
  const startedAt = new Date().toISOString()
  const source = await collectDatabaseMigrationPlan(sourceOrm, sourceConfig)

  await syncDatabaseSchema(targetOrm, 'migration-executor')
  const targetBefore = await collectDatabaseMigrationPlan(
    targetOrm,
    targetConfig
  )

  if (hasBusinessRows(targetBefore)) {
    return {
      success: false,
      startedAt,
      completedAt: new Date().toISOString(),
      source,
      targetBefore,
      targetAfter: null,
      tables: [],
      error:
        'Target database is not empty. Migration requires an empty target database.'
    }
  }

  const tables: DatabaseMigrationTableResult[] = []

  for (const table of MIGRATION_TABLES) {
    try {
      const rows = await readAllRows(sourceOrm, table.tableName)
      const insertedRows = await insertRows(targetOrm, table.tableName, rows)
      tables.push({
        tableName: table.tableName,
        sourceRows: rows.length,
        insertedRows,
        success: rows.length === insertedRows,
        error: null
      })
    } catch (error: unknown) {
      const targetAfter = await collectDatabaseMigrationPlan(
        targetOrm,
        targetConfig
      )
      return {
        success: false,
        startedAt,
        completedAt: new Date().toISOString(),
        source,
        targetBefore,
        targetAfter,
        tables,
        error: `${table.tableName}: ${compactError(error)}`
      }
    }
  }

  const targetAfter = await collectDatabaseMigrationPlan(
    targetOrm,
    targetConfig
  )
  const success = tables.every((table) => table.success)

  return {
    success,
    startedAt,
    completedAt: new Date().toISOString(),
    source,
    targetBefore,
    targetAfter,
    tables,
    error: success ? null : 'One or more tables failed row count validation'
  }
}

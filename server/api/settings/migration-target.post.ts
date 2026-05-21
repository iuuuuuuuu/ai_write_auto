import { MikroORM } from '@mikro-orm/core'
import { z } from 'zod'
import { buildOrmConfig, testConnection } from '../../database'
import {
  getEffectiveDbConfig,
  readDbConfig,
  type DbConfig
} from '../../database/db-config'
import {
  collectDatabaseMigrationPlan,
  type DatabaseMigrationPlan
} from '../../database/migration-plan'
import { syncDatabaseSchema } from '../../database/schema-sync'

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

const preflightSchema = z.object({
  target: dbConfigSchema,
  syncSchema: z.boolean().optional().default(false)
})

interface MigrationTargetPreflightResult {
  success: boolean
  sameAsCurrent: boolean
  schemaSynced: boolean
  plan: DatabaseMigrationPlan | null
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

export default defineEventHandler(
  async (event): Promise<MigrationTargetPreflightResult> => {
    requireAdmin(event)

    const body = await readBody(event)
    const data = preflightSchema.parse(body)
    const target = normalizeTargetConfig(data.target as DbConfig)
    const current = readDbConfig() || getEffectiveDbConfig()
    const sameAsCurrent = isSameDatabaseConfig(current, target)

    if (sameAsCurrent) {
      return {
        success: false,
        sameAsCurrent,
        schemaSynced: false,
        plan: null,
        error: 'Target database is the same as the current database'
      }
    }

    const connection = await testConnection(target)
    if (!connection.success) {
      return {
        success: false,
        sameAsCurrent,
        schemaSynced: false,
        plan: null,
        error: connection.error || 'Target database connection failed'
      }
    }

    let targetOrm: MikroORM | null = null
    try {
      targetOrm = await MikroORM.init(buildOrmConfig(target))

      if (data.syncSchema) {
        await syncDatabaseSchema(targetOrm, 'migration-target-preflight')
      }

      const plan = await collectDatabaseMigrationPlan(targetOrm, target)

      return {
        success: true,
        sameAsCurrent,
        schemaSynced: data.syncSchema,
        plan,
        error: null
      }
    } catch (error: unknown) {
      return {
        success: false,
        sameAsCurrent,
        schemaSynced: false,
        plan: null,
        error:
          error instanceof Error ? error.message : 'Target preflight failed'
      }
    } finally {
      if (targetOrm) {
        await targetOrm.close()
      }
    }
  }
)

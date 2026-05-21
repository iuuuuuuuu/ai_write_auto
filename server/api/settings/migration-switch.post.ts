import { MikroORM } from '@mikro-orm/core'
import { z } from 'zod'
import {
  buildOrmConfig,
  closeOrm,
  initOrm,
  testConnection
} from '../../database'
import {
  getEffectiveDbConfig,
  readDbConfig,
  writeDbConfig,
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

const switchSchema = z.object({
  target: dbConfigSchema,
  confirmSwitch: z.literal(true)
})

interface MigrationSwitchResponse {
  success: boolean
  alreadyActive: boolean
  plan: DatabaseMigrationPlan
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

function hasMigratedUserRows(plan: DatabaseMigrationPlan): boolean {
  return Boolean(
    plan.tables.find((table) => table.tableName === 'users' && table.rows > 0)
  )
}

export default defineEventHandler(
  async (event): Promise<MigrationSwitchResponse> => {
    requireAdmin(event)

    const body = await readBody(event)
    const data = switchSchema.parse(body)
    const target = normalizeTargetConfig(data.target as DbConfig)
    const current = readDbConfig() || getEffectiveDbConfig()

    const connection = await testConnection(target)
    if (!connection.success) {
      throw createError({
        statusCode: 400,
        message: connection.error || 'Target database connection failed'
      })
    }

    let validationOrm: MikroORM | null = null
    try {
      validationOrm = await MikroORM.init(buildOrmConfig(target))
      await syncDatabaseSchema(validationOrm, 'migration-switch')
      const plan = await collectDatabaseMigrationPlan(validationOrm, target)
      if (!hasMigratedUserRows(plan)) {
        throw createError({
          statusCode: 400,
          message:
            'Target database has no user data. Run migration before switching.'
        })
      }

      const alreadyActive = isSameDatabaseConfig(current, target)

      if (!alreadyActive) {
        await closeOrm()
        writeDbConfig(target)
        const orm = await initOrm(target)
        await syncDatabaseSchema(orm, 'migration-switch-active')
      }

      return {
        success: true,
        alreadyActive,
        plan
      }
    } finally {
      if (validationOrm) {
        await validationOrm.close()
      }
    }
  }
)

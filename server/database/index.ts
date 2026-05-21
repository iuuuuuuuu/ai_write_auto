import { MikroORM, type Options } from '@mikro-orm/core'
import { LibSqlDriver } from '@mikro-orm/libsql'
import { MySqlDriver } from '@mikro-orm/mysql'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { getEffectiveDbConfig, readDbConfig, type DbConfig } from './db-config'
import { allEntities } from './entities'

let _orm: MikroORM | null = null

export function buildOrmConfig(dbConfig?: DbConfig): Options {
  const config = dbConfig || getEffectiveDbConfig()

  if (config.type === 'mysql') {
    const mysql = config.mysql!
    return {
      driver: MySqlDriver,
      host: mysql.host,
      port: mysql.port,
      user: mysql.user,
      password: mysql.password,
      dbName: mysql.database,
      entities: allEntities,
      discovery: { disableDynamicFileAccess: true },
      allowGlobalContext: true
    }
  }

  const dbPath = resolve(
    process.cwd(),
    config.sqlite?.path || './data/novel.db'
  )
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  return {
    driver: LibSqlDriver,
    dbName: dbPath,
    entities: allEntities,
    discovery: { disableDynamicFileAccess: true },
    allowGlobalContext: true
  }
}

export async function initOrm(dbConfig?: DbConfig): Promise<MikroORM> {
  if (_orm) return _orm
  const config = buildOrmConfig(dbConfig)
  _orm = await MikroORM.init(config)
  return _orm
}

export function getOrm(): MikroORM {
  if (!_orm) throw new Error('ORM not initialized')
  return _orm
}

export async function closeOrm(): Promise<void> {
  if (_orm) {
    await _orm.close()
    _orm = null
  }
}

export function resetOrm(): void {
  _orm = null
}

export async function testConnection(
  config: DbConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const orm = await MikroORM.init(buildOrmConfig(config))
    const conn = orm.em.getConnection()
    await conn.execute('SELECT 1')
    await orm.close()
    return { success: true }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}

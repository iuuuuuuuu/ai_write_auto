import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { getEffectiveDbConfig, type DbConfig } from './db-config'
import * as schema from './schema'

export type Database = any

let _db: Database | null = null
let _currentConfig: DbConfig | null = null

function createSqliteConnection(config: DbConfig) {
  const dbPath = resolve(process.cwd(), config.sqlite?.path || './data/novel.db')
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const client = createClient({
    url: `file:${dbPath}`,
  })

  return drizzleSqlite(client, { schema })
}

async function createMysqlConnection(config: DbConfig) {
  const mysqlConfig = config.mysql!
  const pool = mysql.createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
  })

  return drizzleMysql(pool, { schema, mode: 'default' })
}

export async function getDatabase(): Promise<Database> {
  const config = getEffectiveDbConfig()

  if (_db && _currentConfig && JSON.stringify(_currentConfig) === JSON.stringify(config)) {
    return _db
  }

  if (config.type === 'mysql') {
    _db = await createMysqlConnection(config)
  } else {
    _db = createSqliteConnection(config)
  }
  _currentConfig = config
  return _db
}

export async function testConnection(config: DbConfig): Promise<{ success: boolean; error?: string }> {
  try {
    if (config.type === 'mysql') {
      const connection = await mysql.createConnection({
        host: config.mysql!.host,
        port: config.mysql!.port,
        user: config.mysql!.user,
        password: config.mysql!.password,
        database: config.mysql!.database,
      })
      await connection.ping()
      await connection.end()
    } else {
      const dbPath = resolve(process.cwd(), config.sqlite?.path || './data/novel.db')
      const dir = dirname(dbPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      const client = createClient({ url: `file:${dbPath}` })
      await client.execute('SELECT 1')
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || 'Connection failed' }
  }
}

export function resetConnection(): void {
  _db = null
  _currentConfig = null
}

export { schema }

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

export interface DbConfig {
  type: 'sqlite' | 'mysql'
  sqlite?: {
    path: string
  }
  mysql?: {
    host: string
    port: number
    user: string
    password: string
    database: string
  }
}

const CONFIG_PATH = resolve(process.cwd(), 'data/db-config.json')

export function getDbConfigPath(): string {
  return CONFIG_PATH
}

export function readDbConfig(): DbConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw) as DbConfig
  } catch {
    return null
  }
}

export function writeDbConfig(config: DbConfig): void {
  const dir = dirname(CONFIG_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function getEffectiveDbConfig(): DbConfig {
  const fileConfig = readDbConfig()
  if (fileConfig) return fileConfig

  const runtimeConfig = useRuntimeConfig()
  return {
    type: (runtimeConfig.dbType as 'sqlite' | 'mysql') || 'sqlite',
    sqlite: {
      path: runtimeConfig.dbSqlitePath || './data/novel.db',
    },
    mysql: {
      host: runtimeConfig.dbMysqlHost || 'localhost',
      port: parseInt(runtimeConfig.dbMysqlPort || '3306', 10),
      user: runtimeConfig.dbMysqlUser || 'root',
      password: runtimeConfig.dbMysqlPassword || '',
      database: runtimeConfig.dbMysqlDatabase || 'ai_novel',
    },
  }
}

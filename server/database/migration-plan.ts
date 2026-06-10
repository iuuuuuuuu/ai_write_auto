import type { MikroORM } from '@mikro-orm/core'
import type { DbConfig } from './db-config'

export interface MigrationTablePlan {
  tableName: string
  label: string
  rows: number
  available: boolean
  error: string | null
}

export interface DatabaseMigrationPlan {
  dialect: DbConfig['type']
  database: string
  generatedAt: string
  tables: MigrationTablePlan[]
  totalRows: number
}

export const MIGRATION_TABLES: Array<{ tableName: string; label: string }> = [
  { tableName: 'users', label: 'Users' },
  { tableName: 'site_config', label: 'Site config' },
  { tableName: 'ai_configs', label: 'AI configs' },
  { tableName: 'novels', label: 'Novels' },
  { tableName: 'novel_outlines', label: 'Novel outlines' },
  { tableName: 'novel_templates', label: 'Novel templates' },
  { tableName: 'chapters', label: 'Chapters' },
  { tableName: 'chapter_versions', label: 'Chapter versions' },
  { tableName: 'chapter_notes', label: 'Chapter notes' },
  { tableName: 'characters', label: 'Characters' },
  { tableName: 'chapter_characters', label: 'Chapter characters' },
  { tableName: 'character_appearances', label: 'Character appearances' },
  { tableName: 'character_state_changes', label: 'Character state changes' },
  {
    tableName: 'character_state_snapshots',
    label: 'Character state snapshots'
  },
  { tableName: 'plot_points', label: 'Plot points' },
  { tableName: 'story_arcs', label: 'Story arcs' },
  { tableName: 'generation_tasks', label: 'Generation tasks' },
  { tableName: 'token_usage', label: 'Token usage' },
  { tableName: 'ai_generation_logs', label: 'AI generation logs' },
  { tableName: 'prompt_templates', label: 'Prompt templates' },
  { tableName: 'writing_stats', label: 'Writing stats' },
  { tableName: 'user_preferences', label: 'User preferences' },
  { tableName: 'schema_migrations', label: 'Schema migrations' }
]

function formatDatabaseName(config: DbConfig): string {
  if (config.type === 'mysql') {
    const mysql = config.mysql
    if (!mysql) return 'mysql://unknown'
    return `mysql://${mysql.user}@${mysql.host}:${mysql.port}/${mysql.database}`
  }

  return config.sqlite?.path || './data/novel.db'
}

function normalizeCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function readCountResult(result: unknown): number {
  if (!Array.isArray(result)) return 0
  const [first] = result
  if (!first || typeof first !== 'object') return 0

  const record = first as Record<string, unknown>
  return normalizeCount(record.count ?? record['COUNT(*)'])
}

async function countTableRows(
  orm: MikroORM,
  tableName: string
): Promise<Pick<MigrationTablePlan, 'rows' | 'available' | 'error'>> {
  try {
    const result = await orm.em
      .getConnection()
      .execute(`SELECT COUNT(*) as count FROM \`${tableName}\``)

    return {
      rows: readCountResult(result),
      available: true,
      error: null
    }
  } catch (error: unknown) {
    return {
      rows: 0,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown table error'
    }
  }
}

export async function collectDatabaseMigrationPlan(
  orm: MikroORM,
  config: DbConfig
): Promise<DatabaseMigrationPlan> {
  const tables = await Promise.all(
    MIGRATION_TABLES.map(async (table) => {
      const count = await countTableRows(orm, table.tableName)
      return {
        ...table,
        ...count
      }
    })
  )

  return {
    dialect: config.type,
    database: formatDatabaseName(config),
    generatedAt: new Date().toISOString(),
    tables,
    totalRows: tables.reduce((sum, table) => sum + table.rows, 0)
  }
}

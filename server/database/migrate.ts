import { createClient } from '@libsql/client'
import mysql from 'mysql2/promise'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { type DbConfig } from './db-config'

const SQLITE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS site_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL DEFAULT '默认模型',
    purpose TEXT NOT NULL,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT NOT NULL,
    temperature TEXT DEFAULT '0.7',
    max_tokens INTEGER DEFAULT 4096,
    is_default INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS novels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    style_guide TEXT,
    world_setting TEXT,
    ai_temperature TEXT,
    ai_extra_prompt TEXT,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS novel_outlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS novel_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    genre TEXT NOT NULL,
    default_style_guide TEXT,
    default_ai_prompt TEXT,
    default_temperature TEXT DEFAULT '0.7'
  )`,
  `CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    word_count INTEGER DEFAULT 0,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS chapter_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    traits TEXT,
    relationships TEXT,
    current_state TEXT,
    first_appearance_chapter INTEGER,
    last_appearance_chapter INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS plot_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_id INTEGER REFERENCES chapters(id),
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'introduced',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS story_arcs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    start_chapter INTEGER NOT NULL,
    end_chapter INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS generation_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novel_id INTEGER NOT NULL REFERENCES novels(id),
    chapter_id INTEGER REFERENCES chapters(id),
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    tokens_used INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    ai_config_id INTEGER REFERENCES ai_configs(id),
    tokens_input INTEGER NOT NULL,
    tokens_output INTEGER NOT NULL,
    estimated_cost TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS chapter_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    is_system INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS writing_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    words_written INTEGER DEFAULT 0,
    chapters_completed INTEGER DEFAULT 0,
    ai_generations INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL
  )`
]

const MYSQL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP())
  )`,
  `CREATE TABLE IF NOT EXISTS site_config (
    \`key\` VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '默认模型',
    purpose VARCHAR(50) NOT NULL,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model VARCHAR(255) NOT NULL,
    temperature VARCHAR(10) DEFAULT '0.7',
    max_tokens INT DEFAULT 4096,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS novels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    genre VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    style_guide TEXT,
    world_setting TEXT,
    ai_temperature VARCHAR(10),
    ai_extra_prompt TEXT,
    deleted_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS novel_outlines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL,
    chapter_number INT NOT NULL,
    description TEXT NOT NULL,
    sort_order INT NOT NULL,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS novel_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    default_style_guide TEXT,
    default_ai_prompt TEXT,
    default_temperature VARCHAR(10) DEFAULT '0.7'
  )`,
  `CREATE TABLE IF NOT EXISTS chapters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL,
    chapter_number INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    content LONGTEXT,
    summary TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    word_count INT DEFAULT 0,
    deleted_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS chapter_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapter_id INT NOT NULL,
    version_number INT NOT NULL,
    content LONGTEXT NOT NULL,
    source VARCHAR(20) NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS \`characters\` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    traits TEXT,
    relationships TEXT,
    current_state TEXT,
    first_appearance_chapter INT,
    last_appearance_chapter INT,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS plot_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL,
    chapter_id INT,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'introduced',
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
  )`,
  `CREATE TABLE IF NOT EXISTS story_arcs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    start_chapter INT NOT NULL,
    end_chapter INT,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS generation_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    novel_id INT NOT NULL,
    chapter_id INT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    result LONGTEXT,
    error TEXT,
    retry_count INT DEFAULT 0,
    tokens_used INT,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    completed_at BIGINT,
    FOREIGN KEY (novel_id) REFERENCES novels(id),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
  )`,
  `CREATE TABLE IF NOT EXISTS token_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ai_config_id INT,
    tokens_input INT NOT NULL,
    tokens_output INT NOT NULL,
    estimated_cost VARCHAR(50),
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (ai_config_id) REFERENCES ai_configs(id)
  )`,
  `CREATE TABLE IF NOT EXISTS chapter_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapter_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(20) NOT NULL,
    is_system TINYINT(1) DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS writing_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date VARCHAR(10) NOT NULL,
    words_written INT DEFAULT 0,
    chapters_completed INT DEFAULT 0,
    ai_generations INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    \`key\` VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`
]

const SQLITE_AI_CONFIG_COLUMNS = [
  {
    name: 'name',
    sql: `ALTER TABLE ai_configs ADD COLUMN name TEXT NOT NULL DEFAULT '默认模型'`
  },
  {
    name: 'is_default',
    sql: `ALTER TABLE ai_configs ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0`
  },
  {
    name: 'enabled',
    sql: `ALTER TABLE ai_configs ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`
  }
]

const MYSQL_AI_CONFIG_COLUMNS = [
  {
    name: 'name',
    sql: `ALTER TABLE ai_configs ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '默认模型'`
  },
  {
    name: 'is_default',
    sql: `ALTER TABLE ai_configs ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0`
  },
  {
    name: 'enabled',
    sql: `ALTER TABLE ai_configs ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1`
  }
]

async function ensureSqliteAiConfigColumns(
  client: ReturnType<typeof createClient>
) {
  const result = await client.execute('PRAGMA table_info(ai_configs)')
  const existingColumns = new Set(result.rows.map((row) => String(row.name)))

  for (const column of SQLITE_AI_CONFIG_COLUMNS) {
    if (!existingColumns.has(column.name)) {
      try {
        await client.execute(column.sql)
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes('duplicate column name')
        ) {
          throw error
        }
      }
    }
  }

  await client.execute(
    `UPDATE ai_configs SET name = model WHERE name = '默认模型' OR name IS NULL`
  )
  await client.execute(
    `UPDATE ai_configs SET is_default = 1 WHERE id IN (SELECT MIN(id) FROM ai_configs GROUP BY user_id, purpose) AND is_default = 0`
  )
}

async function ensureMysqlAiConfigColumns(connection: mysql.Connection) {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    'SHOW COLUMNS FROM ai_configs'
  )
  const existingColumns = new Set(rows.map((row) => String(row.Field)))

  for (const column of MYSQL_AI_CONFIG_COLUMNS) {
    if (!existingColumns.has(column.name)) {
      try {
        await connection.execute(column.sql)
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes('Duplicate column name')
        ) {
          throw error
        }
      }
    }
  }

  await connection.execute(
    `UPDATE ai_configs SET name = model WHERE name = '默认模型' OR name IS NULL`
  )
  await connection.execute(
    `UPDATE ai_configs SET is_default = 1 WHERE id IN (SELECT id FROM (SELECT MIN(id) AS id FROM ai_configs GROUP BY user_id, purpose) defaults) AND is_default = 0`
  )
}

export async function runMigrations(config: DbConfig): Promise<void> {
  if (config.type === 'mysql') {
    const mysqlConfig = config.mysql!
    const connection = await mysql.createConnection({
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      database: mysqlConfig.database,
      multipleStatements: true
    })
    for (const stmt of MYSQL_STATEMENTS) {
      await connection.execute(stmt)
    }
    await ensureMysqlAiConfigColumns(connection)
    await connection.end()
  } else {
    const dbPath = resolve(
      process.cwd(),
      config.sqlite?.path || './data/novel.db'
    )
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const client = createClient({ url: `file:${dbPath}` })
    for (const stmt of SQLITE_STATEMENTS) {
      await client.execute(stmt)
    }
    await ensureSqliteAiConfigColumns(client)
  }
}

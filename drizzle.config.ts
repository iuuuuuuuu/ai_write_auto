/// <reference types="node" />
import { defineConfig } from 'drizzle-kit'

// drizzle-kit push/generate/migrate 仅支持 SQLite（schema 使用 sqlite-core 定义）
// MySQL 的表结构由 server/plugins/migrate.ts 在启动时自动同步
export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_SQLITE_PATH || './data/novel.db',
  },
})

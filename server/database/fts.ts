import type { MikroORM } from '@mikro-orm/core'
import { getEffectiveDbConfig } from './db-config'

export async function ensureFts(orm: MikroORM): Promise<void> {
  const config = getEffectiveDbConfig()

  if (config.type === 'mysql') {
    await ensureMysqlFulltext(orm)
  } else {
    await ensureSqliteFts5(orm)
  }
}

async function ensureSqliteFts5(orm: MikroORM): Promise<void> {
  const conn = orm.em.getConnection()

  await conn.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(
      title,
      content,
      content='chapters',
      content_rowid='id',
      tokenize='unicode61'
    )
  `)

  await conn.execute(`
    CREATE TRIGGER IF NOT EXISTS chapters_fts_insert AFTER INSERT ON chapters BEGIN
      INSERT INTO chapters_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END
  `)

  await conn.execute(`
    CREATE TRIGGER IF NOT EXISTS chapters_fts_delete AFTER DELETE ON chapters BEGIN
      INSERT INTO chapters_fts(chapters_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
    END
  `)

  await conn.execute(`
    CREATE TRIGGER IF NOT EXISTS chapters_fts_update AFTER UPDATE ON chapters BEGIN
      INSERT INTO chapters_fts(chapters_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
      INSERT INTO chapters_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END
  `)

  // Rebuild index from existing data
  const existingCount = await conn.execute(`SELECT COUNT(*) as cnt FROM chapters_fts`) as any
  const count = Array.isArray(existingCount) ? existingCount[0]?.cnt : 0
  if (!count || count === 0) {
    await conn.execute(`
      INSERT INTO chapters_fts(rowid, title, content)
      SELECT id, title, content FROM chapters WHERE content IS NOT NULL
    `)
  }
}

async function ensureMysqlFulltext(orm: MikroORM): Promise<void> {
  const conn = orm.em.getConnection()

  const [rows] = await conn.execute(`
    SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'chapters'
      AND INDEX_NAME = 'ft_chapters_content'
  `) as any

  if (!rows || (Array.isArray(rows) && rows.length === 0)) {
    await conn.execute(`
      ALTER TABLE chapters ADD FULLTEXT INDEX ft_chapters_content (title, content)
    `)
  }
}

export async function searchFts(
  orm: MikroORM,
  keyword: string,
  opts: { userId: number; novelId?: number; limit?: number }
): Promise<Array<{ id: number; title: string; chapterNumber: number; novelId: number; snippet: string }>> {
  const config = getEffectiveDbConfig()
  const limit = opts.limit || 50

  if (config.type === 'mysql') {
    return searchMysqlFulltext(orm, keyword, opts, limit)
  }
  return searchSqliteFts5(orm, keyword, opts, limit)
}

async function searchSqliteFts5(
  orm: MikroORM,
  keyword: string,
  opts: { userId: number; novelId?: number },
  limit: number
): Promise<Array<{ id: number; title: string; chapterNumber: number; novelId: number; snippet: string }>> {
  const conn = orm.em.getConnection()

  const ftsQuery = keyword.replace(/['"]/g, '').split(/\s+/).filter(Boolean).join(' OR ')
  if (!ftsQuery) return []

  let sql = `
    SELECT c.id, c.title, c.chapter_number as chapterNumber, c.novel_id as novelId,
           snippet(chapters_fts, 1, '<mark>', '</mark>', '...', 40) as snippet
    FROM chapters_fts
    JOIN chapters c ON c.id = chapters_fts.rowid
    JOIN novels n ON n.id = c.novel_id
    WHERE chapters_fts MATCH ?
      AND n.user_id = ?
      AND n.deleted_at IS NULL
      AND c.deleted_at IS NULL
  `
  const params: any[] = [ftsQuery, opts.userId]

  if (opts.novelId) {
    sql += ' AND c.novel_id = ?'
    params.push(opts.novelId)
  }

  sql += ` ORDER BY rank LIMIT ?`
  params.push(limit)

  const rows = await conn.execute(sql, params) as any[]
  return (rows || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    chapterNumber: r.chapterNumber,
    novelId: r.novelId,
    snippet: r.snippet || '',
  }))
}

async function searchMysqlFulltext(
  orm: MikroORM,
  keyword: string,
  opts: { userId: number; novelId?: number },
  limit: number
): Promise<Array<{ id: number; title: string; chapterNumber: number; novelId: number; snippet: string }>> {
  const conn = orm.em.getConnection()

  let sql = `
    SELECT c.id, c.title, c.chapter_number as chapterNumber, c.novel_id as novelId,
           SUBSTRING(c.content, GREATEST(1, LOCATE(?, c.content) - 40), 120) as snippet
    FROM chapters c
    JOIN novels n ON n.id = c.novel_id
    WHERE MATCH(c.title, c.content) AGAINST(? IN BOOLEAN MODE)
      AND n.user_id = ?
      AND n.deleted_at IS NULL
      AND c.deleted_at IS NULL
  `
  const params: any[] = [keyword, keyword, opts.userId]

  if (opts.novelId) {
    sql += ' AND c.novel_id = ?'
    params.push(opts.novelId)
  }

  sql += ` LIMIT ?`
  params.push(limit)

  const rows = await conn.execute(sql, params) as any[]
  return (rows || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    chapterNumber: r.chapterNumber,
    novelId: r.novelId,
    snippet: r.snippet ? `...${r.snippet}...` : '',
  }))
}

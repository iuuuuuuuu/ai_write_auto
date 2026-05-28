import { getOrm } from '../database'
import { readDbConfig } from '../database/db-config'
import { getEmbeddingDim } from './embedding'

export interface VectorRecord {
  id?: number
  characterId: number
  chapterId: number | null
  novelId: number
  contentType: 'chapter_story' | 'overall_arc' | 'profile' | 'plot_event' | 'world_detail' | 'foreshadowing' | 'chapter_summary'
  content: string
  embedding: Float32Array
}

export interface VectorSearchResult {
  id: number
  characterId: number
  chapterId: number | null
  contentType: string
  content: string
  score: number
}

function cosineDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0, normA = 0, normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const ai = a[i]!
    const bi = b[i]!
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 1 : 1 - dot / denom
}

export async function ensureVectorTable(): Promise<void> {
  const orm = getOrm()
  const conn = orm.em.getConnection()
  const config = readDbConfig()
  const dim = getEmbeddingDim()

  if (config?.type === 'mysql') {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS character_embeddings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        character_id INT NOT NULL,
        chapter_id INT,
        novel_id INT NOT NULL,
        content_type VARCHAR(50) NOT NULL DEFAULT 'chapter_story',
        content TEXT NOT NULL,
        embedding JSON,
        created_at BIGINT NOT NULL,
        INDEX idx_ce_novel (novel_id),
        INDEX idx_ce_char (character_id)
      )
    `)
  } else {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS character_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        chapter_id INTEGER,
        novel_id INTEGER NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'chapter_story',
        content TEXT NOT NULL,
        embedding F32_BLOB(${dim}),
        created_at INTEGER NOT NULL
      )
    `)
    await conn.execute(`
      CREATE INDEX IF NOT EXISTS idx_ce_novel ON character_embeddings(novel_id)
    `)
    await conn.execute(`
      CREATE INDEX IF NOT EXISTS idx_ce_char ON character_embeddings(character_id)
    `)
    try {
      await conn.execute(`
        CREATE INDEX IF NOT EXISTS idx_ce_vec ON character_embeddings(
          libsql_vector_idx(embedding, 'metric=cosine')
        )
      `)
    } catch {}
  }
}
export async function upsertVector(record: VectorRecord): Promise<void> {
  const orm = getOrm()
  const conn = orm.em.getConnection()
  const config = readDbConfig()
  const now = Date.now()

  await conn.execute(
    `DELETE FROM character_embeddings WHERE character_id = ? AND chapter_id ${record.chapterId == null ? 'IS NULL' : '= ?'} AND content_type = ? AND novel_id = ?`,
    record.chapterId == null
      ? [record.characterId, record.contentType, record.novelId]
      : [record.characterId, record.chapterId, record.contentType, record.novelId]
  )

  if (config?.type === 'mysql') {
    const embeddingJson = JSON.stringify(Array.from(record.embedding))
    await conn.execute(
      `INSERT INTO character_embeddings (character_id, chapter_id, novel_id, content_type, content, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [record.characterId, record.chapterId, record.novelId, record.contentType, record.content, embeddingJson, now]
    )
  } else {
    const embeddingJson = JSON.stringify(Array.from(record.embedding))
    await conn.execute(
      `INSERT INTO character_embeddings (character_id, chapter_id, novel_id, content_type, content, embedding, created_at) VALUES (?, ?, ?, ?, ?, vector32(?), ?)`,
      [record.characterId, record.chapterId, record.novelId, record.contentType, record.content, embeddingJson, now]
    )
  }
}

export async function searchVectors(
  queryEmbedding: Float32Array,
  novelId: number,
  topK: number = 10
): Promise<VectorSearchResult[]> {
  const orm = getOrm()
  const conn = orm.em.getConnection()
  const config = readDbConfig()

  if (config?.type === 'mysql') {
    const rows = await conn.execute(
      `SELECT id, character_id, chapter_id, content_type, content, embedding FROM character_embeddings WHERE novel_id = ?`,
      [novelId]
    ) as any[]

    const scored = rows.map((row: any) => {
      const stored = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding
      const dist = cosineDistance(queryEmbedding, stored)
      return {
        id: row.id,
        characterId: row.character_id,
        chapterId: row.chapter_id,
        contentType: row.content_type,
        content: row.content,
        score: 1 - dist
      }
    })

    scored.sort((a: any, b: any) => b.score - a.score)
    return scored.slice(0, topK)
  } else {
    const embeddingJson = JSON.stringify(Array.from(queryEmbedding))
    const rows = await conn.execute(
      `SELECT id, character_id, chapter_id, content_type, content,
              vector_distance_cos(embedding, vector32(?)) as distance
       FROM character_embeddings
       WHERE novel_id = ?
       ORDER BY distance
       LIMIT ?`,
      [embeddingJson, novelId, topK]
    ) as any[]

    return rows.map((row: any) => ({
      id: row.id,
      characterId: row.character_id,
      chapterId: row.chapter_id,
      contentType: row.content_type,
      content: row.content,
      score: 1 - (row.distance || 0)
    }))
  }
}

export async function deleteVectorsByCharacter(characterId: number): Promise<void> {
  const orm = getOrm()
  const conn = orm.em.getConnection()
  await conn.execute(`DELETE FROM character_embeddings WHERE character_id = ?`, [characterId])
}

export async function deleteVectorsByChapter(characterId: number, chapterId: number): Promise<void> {
  const orm = getOrm()
  const conn = orm.em.getConnection()
  await conn.execute(
    `DELETE FROM character_embeddings WHERE character_id = ? AND chapter_id = ?`,
    [characterId, chapterId]
  )
}

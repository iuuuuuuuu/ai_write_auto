import type { MikroORM } from '@mikro-orm/core'
import {
  SchemaMigrationSchema,
  SiteConfigSchema,
  AiProviderSchema
} from './entities'
import { syncNovelTemplateSeeds } from '../services/novel-template-seeds'
import { syncWritingSkillSeeds } from '../services/writing-skill-seeds'

export const DATABASE_SCHEMA_VERSION = '2026.06.09.001'

export interface DatabaseSchemaSyncResult {
  version: string
  syncedAt: string
  source: string
}

async function upsertSiteConfig(
  orm: MikroORM,
  key: string,
  value: string
): Promise<void> {
  const em = orm.em.fork()
  const existing = await em.findOne(SiteConfigSchema, { key })

  if (existing) {
    existing.value = value
  } else {
    em.create(SiteConfigSchema, { key, value })
  }

  await em.flush()
}

async function migrateModelsToProviders(orm: MikroORM): Promise<void> {
  const conn = orm.em.getConnection()

  // Check if old columns still exist
  let hasOldColumns = false
  try {
    await conn.execute('SELECT api_url FROM ai_models LIMIT 1')
    hasOldColumns = true
  } catch {
    return // migration already done
  }

  if (!hasOldColumns) return

  // Ensure provider_id column exists — run in same connection context
  try {
    await conn.execute('ALTER TABLE ai_models ADD COLUMN provider_id INTEGER')
  } catch {
    // Column already exists, ignore
  }

  // Also ensure ai_providers table exists (in case updateSchema hasn't run yet)
  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      api_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_check_at INTEGER,
      last_check_available INTEGER,
      last_check_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`)
  } catch {}

  // Read all models that have api_url/api_key but no provider_id
  const rows = (await conn.execute(
    `SELECT id, user_id, api_url, api_key FROM ai_models
     WHERE (provider_id IS NULL OR provider_id = 0)
       AND api_url IS NOT NULL AND api_url != ''`
  )) as any[]

  if (!rows || rows.length === 0) {
    try {
      await conn.execute('ALTER TABLE ai_models DROP COLUMN api_url')
      await conn.execute('ALTER TABLE ai_models DROP COLUMN api_key')
    } catch {}
    return
  }

  const em = orm.em.fork()
  const providerMap = new Map<string, number>()

  for (const row of rows) {
    const mapKey = `${row.user_id}|${row.api_url}|${row.api_key}`
    if (!providerMap.has(mapKey)) {
      const existing = await em.findOne(AiProviderSchema, {
        user: row.user_id,
        apiUrl: row.api_url,
        apiKey: row.api_key
      })
      if (existing) {
        providerMap.set(mapKey, existing.id)
      } else {
        let name = 'API Provider'
        try {
          name = new URL(row.api_url).hostname
        } catch {}
        const provider = em.create(AiProviderSchema, {
          user: row.user_id,
          name,
          apiUrl: row.api_url,
          apiKey: row.api_key,
          enabled: true
        })
        await em.flush()
        providerMap.set(mapKey, provider.id)
      }
    }
  }

  for (const row of rows) {
    const providerId = providerMap.get(
      `${row.user_id}|${row.api_url}|${row.api_key}`
    )
    if (providerId) {
      await conn.execute('UPDATE ai_models SET provider_id = ? WHERE id = ?', [
        providerId,
        row.id
      ])
    }
  }

  try {
    await conn.execute('ALTER TABLE ai_models DROP COLUMN api_url')
    await conn.execute('ALTER TABLE ai_models DROP COLUMN api_key')
  } catch {}
}

async function recordSchemaMigration(
  orm: MikroORM,
  version: string,
  source: string
): Promise<void> {
  const em = orm.em.fork()
  const existing = await em.findOne(SchemaMigrationSchema, { version })

  if (existing) {
    existing.source = source
  } else {
    em.create(SchemaMigrationSchema, { version, source })
  }

  await em.flush()
}

export async function syncDatabaseSchema(
  orm: MikroORM,
  source: string
): Promise<DatabaseSchemaSyncResult> {
  const generator = orm.getSchemaGenerator()

  try {
    await generator.updateSchema({ safe: true, dropTables: false })
  } catch (e: any) {
    if (e?.message?.includes('Cannot read properties of null')) {
      // FTS5/vector virtual tables confuse MikroORM's schema introspection.
      // Drop them temporarily, sync schema, then they'll be recreated by ensureFts.
      const conn = orm.em.getConnection()
      try {
        await conn.execute('DROP TABLE IF EXISTS chapters_fts')
        await conn.execute('DROP TRIGGER IF EXISTS chapters_fts_insert')
        await conn.execute('DROP TRIGGER IF EXISTS chapters_fts_delete')
        await conn.execute('DROP TRIGGER IF EXISTS chapters_fts_update')
      } catch {}
      try {
        await conn.execute('DROP TABLE IF EXISTS vec_character_embeddings')
      } catch {}
      await generator.updateSchema({ safe: true, dropTables: false })
    } else {
      throw e
    }
  }

  const syncedAt = new Date().toISOString()

  // Migrate existing ai_models data to new provider structure
  await migrateModelsToProviders(orm)
  if (source !== 'setup') {
    await syncNovelTemplateSeeds(orm)
  }
  await syncWritingSkillSeeds(orm)

  await recordSchemaMigration(orm, DATABASE_SCHEMA_VERSION, source)
  await upsertSiteConfig(orm, 'schema_version', DATABASE_SCHEMA_VERSION)
  await upsertSiteConfig(orm, 'schema_last_synced_at', syncedAt)
  await upsertSiteConfig(orm, 'schema_sync_source', source)

  return {
    version: DATABASE_SCHEMA_VERSION,
    syncedAt,
    source
  }
}

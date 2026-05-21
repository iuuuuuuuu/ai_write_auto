import type { MikroORM } from '@mikro-orm/core'
import { SchemaMigrationSchema, SiteConfigSchema } from './entities'

export const DATABASE_SCHEMA_VERSION = '2026.05.21.001'

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
  await generator.updateSchema({ safe: true, dropTables: false })

  const syncedAt = new Date().toISOString()
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

import { readDbConfig } from '../database/db-config'
import { initOrm } from '../database'
import { syncDatabaseSchema } from '../database/schema-sync'
import { ensureFts } from '../database/fts'
import {
  createStartupBackupIfEnabled,
  startScheduledBackup,
  stopScheduledBackup
} from '../services/database-backup'
import { ensureVectorTable } from '../services/vector-store'

export default defineNitroPlugin(async (nitroApp) => {
  const fileConfig = readDbConfig()
  if (!fileConfig) return

  try {
    const orm = await initOrm(fileConfig)
    const schema = await syncDatabaseSchema(orm, 'startup')
    console.log(`[db] MikroORM initialized, schema ${schema.version} synced`)

    try {
      const backupName = await createStartupBackupIfEnabled(orm)
      if (backupName) {
        console.log(`[db] Startup SQLite backup created: ${backupName}`)
      }
    } catch (e) {
      console.warn('[db] Startup SQLite backup skipped:', e)
    }

    try {
      startScheduledBackup(orm)
      console.log('[db] Scheduled backup service started')
    } catch (e) {
      console.warn('[db] Scheduled backup service failed to start:', e)
    }

    try {
      await ensureFts(orm)
      console.log('[db] FTS index ensured')
    } catch (e) {
      console.warn('[db] FTS index creation skipped:', e)
    }

    try {
      await ensureVectorTable()
      console.log('[db] Vector table ensured')
    } catch (e) {
      console.warn('[db] Vector table creation skipped:', e)
    }

    nitroApp.hooks.hook('close', async () => {
      stopScheduledBackup()
      await orm.close()
    })
  } catch (e) {
    console.error('[db] MikroORM initialization failed:', e)
  }
})

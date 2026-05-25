import { readDbConfig } from '../database/db-config'
import { initOrm } from '../database'
import { syncDatabaseSchema } from '../database/schema-sync'
import { ensureFts } from '../database/fts'
import {
  createStartupBackupIfEnabled,
  startScheduledBackup,
  stopScheduledBackup
} from '../services/database-backup'
import {
  startTrashCleanup,
  stopTrashCleanup
} from '../services/trash-cleanup'
import { ensureVectorTable } from '../services/vector-store'
import { tryAutoLoadEmbedding, stopEmbedding } from '../services/embedding'
import { processPendingTasks } from '../services/task-queue'

export default defineNitroPlugin(async (nitroApp) => {
  const fileConfig = readDbConfig()
  if (!fileConfig) {
    console.log('[db] No db-config.json found, skipping initialization')
    return
  }

  try {
    const orm = await initOrm(fileConfig)
    const schema = await syncDatabaseSchema(orm, 'startup')
    console.log(`[db] MikroORM initialized, schema ${schema.version} synced`)

    // Non-blocking background initialization
    setTimeout(async () => {
      try {
        const backupName = await createStartupBackupIfEnabled(orm)
        if (backupName) console.log(`[db] Startup SQLite backup created: ${backupName}`)
      } catch {}

      try {
        startScheduledBackup(orm)
        console.log('[db] Scheduled backup service started')
      } catch {}

      try {
        startTrashCleanup(orm)
        console.log('[db] Trash cleanup service started')
      } catch {}

      try {
        await ensureFts(orm)
        console.log('[db] FTS index ensured')
      } catch (e) {
        console.warn('[db] FTS index creation skipped:', e)
      }

      try {
        await ensureVectorTable()
        console.log('[db] Vector table ensured')
      } catch {}

      tryAutoLoadEmbedding()
    }, 0)

    // Delay task processing significantly - avoid blocking SSR with AI API timeouts
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        processPendingTasks().catch(() => {})
      }, 60000)
    }

    nitroApp.hooks.hook('close', async () => {
      stopScheduledBackup()
      stopTrashCleanup()
      stopEmbedding()
      await orm.close()
    })
  } catch (e) {
    console.error('[db] MikroORM initialization failed:', e)
  }
})

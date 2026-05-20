import { readDbConfig } from '../database/db-config'
import { initOrm } from '../database'
import { ensureVectorTable } from '../services/vector-store'

export default defineNitroPlugin(async (nitroApp) => {
  const fileConfig = readDbConfig()
  if (!fileConfig) return

  try {
    const orm = await initOrm(fileConfig)
    const generator = orm.getSchemaGenerator()
    await generator.updateSchema({ safe: true, dropTables: false })
    console.log('[db] MikroORM initialized, schema synced')

    try {
      await ensureVectorTable()
      console.log('[db] Vector table ensured')
    } catch (e) {
      console.warn('[db] Vector table creation skipped:', e)
    }

    nitroApp.hooks.hook('close', async () => {
      await orm.close()
    })
  } catch (e) {
    console.error('[db] MikroORM initialization failed:', e)
  }
})

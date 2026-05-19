import { readDbConfig } from '../database/db-config'
import { initOrm } from '../database'

export default defineNitroPlugin(async (nitroApp) => {
  const fileConfig = readDbConfig()
  if (!fileConfig) return

  try {
    const orm = await initOrm(fileConfig)
    const generator = orm.getSchemaGenerator()
    await generator.updateSchema({ safe: true, dropTables: false })
    console.log('[db] MikroORM initialized, schema synced')

    nitroApp.hooks.hook('close', async () => {
      await orm.close()
    })
  } catch (e) {
    console.error('[db] MikroORM initialization failed:', e)
  }
})

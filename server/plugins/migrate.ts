import { runMigrations } from '../database/migrate'
import { getEffectiveDbConfig, readDbConfig } from '../database/db-config'

export default defineNitroPlugin(async () => {
  const fileConfig = readDbConfig()
  if (!fileConfig) return

  try {
    await runMigrations(getEffectiveDbConfig())
    console.log('[db] Auto-migration completed')
  } catch (e) {
    console.error('[db] Auto-migration failed:', e)
  }
})

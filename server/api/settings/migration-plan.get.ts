import { readDbConfig, getEffectiveDbConfig } from '../../database/db-config'
import { getOrm } from '../../database'
import { collectDatabaseMigrationPlan } from '../../database/migration-plan'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const config = readDbConfig() || getEffectiveDbConfig()
  const orm = getOrm()
  return collectDatabaseMigrationPlan(orm, config)
})

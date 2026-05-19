import { readDbConfig } from '../../database/db-config'

export default defineEventHandler(() => {
  const config = readDbConfig()
  return {
    initialized: !!config,
    dbType: config?.type || null,
  }
})

import { readDbConfig } from '../database/db-config'

const PUBLIC_PATHS = ['/api/setup', '/api/auth/login', '/api/auth/register']

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/') || PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return
  }

  const config = readDbConfig()
  if (!config) {
    throw createError({ statusCode: 503, message: 'System not initialized' })
  }
})

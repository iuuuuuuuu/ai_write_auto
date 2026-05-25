import { ApiTokenSchema } from '../database/entities'

const PUBLIC_PATHS = ['/api/setup', '/api/auth/login', '/api/auth/register', '/api/openapi/spec']

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/') || PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return
  }

  const token = getTokenFromEvent(event)
  if (!token) return

  const payload = verifyToken(token)
  if (payload) {
    event.context.auth = payload
    return
  }

  try {
    const em = event.context.em
    if (!em) return
    const bcrypt = await import('bcryptjs')
    const tokens = await em.find(ApiTokenSchema, {}, { populate: ['user'] })
    for (const apiToken of tokens) {
      if (bcrypt.compareSync(token, apiToken.tokenHash)) {
        event.context.auth = {
          userId: apiToken.user.id,
          username: apiToken.user.username,
          role: apiToken.user.role
        }
        apiToken.lastUsedAt = new Date()
        await em.flush()
        return
      }
    }
  } catch {}
})

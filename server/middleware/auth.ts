import { verifyToken, getTokenFromEvent } from '../utils/auth'
import { ApiTokenSchema } from '../database/entities'
import { getOrm } from '../database'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // 跳过公开路径
  if (
    path.startsWith('/api/setup/') ||
    path.startsWith('/api/auth/') ||
    path === '/api/openapi/spec' ||
    path === '/api/openapi/spec.json'
  ) {
    return
  }

  if (event.context.auth) return

  const token = getTokenFromEvent(event)
  if (!token) return

  // 先尝试 JWT
  const jwtPayload = verifyToken(token)
  if (jwtPayload) {
    event.context.auth = jwtPayload
    return
  }

  // 再尝试 API Token
  try {
    const orm = getOrm()
    if (!orm) return
    const em = orm.em.fork()
    const tokens = await em.find(ApiTokenSchema, {}, { populate: ['user'] })
    const bcrypt = await import('bcryptjs')
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
  } catch {
    // ignore
  }
})

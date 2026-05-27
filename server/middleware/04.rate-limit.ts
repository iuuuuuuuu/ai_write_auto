import { checkRateLimit, checkIpRateLimit } from '../utils/rate-limit'

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const method = getMethod(event)

  // Stricter rate limit on auth endpoints (login, register) by IP
  if ((path === '/api/auth/login' || path === '/api/auth/register') && method === 'POST') {
    const ip = getRequestIP(event) || getRequestHeader(event, 'x-forwarded-for') || 'unknown'
    const ipCheck = checkIpRateLimit(ip, 10, 60 * 1000) // 10 requests per minute
    if (!ipCheck.allowed) {
      throw createError({
        statusCode: 429,
        message: `Too many requests. Try again in ${Math.ceil(ipCheck.resetIn / 1000)}s`
      })
    }
    return
  }

  // Rate limit AI endpoints by authenticated user
  if (!path.startsWith('/api/ai/') || method !== 'POST') return

  const auth = event.context.auth
  if (!auth?.userId) return

  const rateCheck = checkRateLimit(auth.userId)
  if (!rateCheck.allowed) {
    throw createError({
      statusCode: 429,
      message: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetIn / 1000)}s`
    })
  }
})

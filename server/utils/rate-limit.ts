const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 20

export function checkRateLimit(userId: number): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `user:${userId}`
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetIn: entry.resetAt - now }
}

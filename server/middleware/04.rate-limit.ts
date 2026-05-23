import { checkRateLimit } from '../utils/rate-limit'

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/ai/') || getMethod(event) !== 'POST') return

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

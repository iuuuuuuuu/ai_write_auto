const PUBLIC_PATHS = ['/api/setup', '/api/auth/login', '/api/auth/register']

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/') || PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return
  }

  const token = getTokenFromEvent(event)
  if (!token) return

  const payload = verifyToken(token)
  if (payload) {
    event.context.auth = payload
  }
})

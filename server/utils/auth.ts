import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

interface JwtPayload {
  userId: number
  username: string
  role: 'admin' | 'user'
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export function signToken(payload: JwtPayload): string {
  const config = useRuntimeConfig()
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload | null {
  const config = useRuntimeConfig()
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload
  } catch {
    return null
  }
}

export function getTokenFromEvent(event: any): string | null {
  const cookie = getCookie(event, 'auth_token')
  if (cookie) return cookie

  const header = getHeader(event, 'authorization')
  if (header?.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return null
}

export function requireAuth(event: any): JwtPayload {
  const token = getTokenFromEvent(event)
  if (!token) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const payload = verifyToken(token)
  if (!payload) {
    throw createError({ statusCode: 401, message: 'Invalid token' })
  }
  return payload
}

export function requireAdmin(event: any): JwtPayload {
  const payload = requireAuth(event)
  if (payload.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return payload
}

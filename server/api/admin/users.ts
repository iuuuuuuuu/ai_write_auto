import { z } from 'zod'
import { hashPassword } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const users = await em.find('User', {})
    return users.map((u: any) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
    }))
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6),
      role: z.enum(['admin', 'user']).default('user'),
    }).parse(body)

    const existing = await em.findOne('User', { username: data.username })
    if (existing) {
      throw createError({ statusCode: 409, message: 'Username already exists' })
    }

    const user = em.create('User', {
      username: data.username,
      passwordHash: hashPassword(data.password),
      role: data.role,
    })
    await em.flush()

    return { id: (user as any).id, username: (user as any).username, role: (user as any).role }
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = parseInt(query.id as string)

    if (id === 1) {
      throw createError({ statusCode: 400, message: 'Cannot delete the primary admin' })
    }

    await em.nativeDelete('User', { id })
    return { success: true }
  }
})

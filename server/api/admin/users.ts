import { z } from 'zod'
import { hashPassword } from '../../utils/auth'
import { UserSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const query = getQuery(event)
    const pagination = parsePagination(event)
    const search = (query.search as string || '').trim().toLowerCase()

    const filter: Record<string, any> = {}
    if (search) {
      filter.username = { $like: `%${search}%` }
    }

    const [users, total] = await Promise.all([
      em.find(UserSchema, filter, {
        limit: pagination.limit,
        offset: pagination.offset,
        orderBy: { createdAt: 'DESC' },
      }),
      em.count(UserSchema, filter),
    ])

    const items = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
    }))

    return paginatedResult(items, total, pagination)
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6),
      role: z.enum(['admin', 'user']).default('user'),
    }).parse(body)

    const existing = await em.findOne(UserSchema, { username: data.username })
    if (existing) {
      throw createError({ statusCode: 409, message: 'Username already exists' })
    }

    const user = em.create(UserSchema, {
      username: data.username,
      passwordHash: hashPassword(data.password),
      role: data.role,
    })
    await em.flush()

    return { id: user.id, username: user.username, role: user.role }
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = parseInt(query.id as string)

    if (id === 1) {
      throw createError({ statusCode: 400, message: 'Cannot delete the primary admin' })
    }

    await em.nativeDelete(UserSchema, { id })
    return { success: true }
  }
})

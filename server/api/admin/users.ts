import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { hashPassword } from '../../utils/auth'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const method = getMethod(event)
  const db = await getDatabase()

  if (method === 'GET') {
    const users = await (db as any)
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
    return users
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6),
      role: z.enum(['admin', 'user']).default('user'),
    }).parse(body)

    const existing = await (db as any)
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, data.username))
      .limit(1)

    if (existing.length) {
      throw createError({ statusCode: 409, message: 'Username already exists' })
    }

    const result = await (db as any).insert(schema.users).values({
      username: data.username,
      passwordHash: hashPassword(data.password),
      role: data.role,
    }).returning()

    return { id: result[0].id, username: result[0].username, role: result[0].role }
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = parseInt(query.id as string)

    if (id === 1) {
      throw createError({ statusCode: 400, message: 'Cannot delete the primary admin' })
    }

    await (db as any).delete(schema.users).where(eq(schema.users.id, id))
    return { success: true }
  }
})

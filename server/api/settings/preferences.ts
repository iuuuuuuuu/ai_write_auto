import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

const prefSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const db = await getDatabase()

  if (method === 'GET') {
    const prefs = await (db as any)
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, auth.userId))

    const result: Record<string, string> = {}
    for (const p of prefs) {
      result[p.key] = p.value
    }
    return result
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const data = prefSchema.parse(body)

    const existing = await (db as any)
      .select()
      .from(schema.userPreferences)
      .where(and(eq(schema.userPreferences.userId, auth.userId), eq(schema.userPreferences.key, data.key)))
      .limit(1)

    if (existing.length) {
      await (db as any)
        .update(schema.userPreferences)
        .set({ value: data.value })
        .where(eq(schema.userPreferences.id, existing[0].id))
    } else {
      await (db as any).insert(schema.userPreferences).values({
        userId: auth.userId,
        key: data.key,
        value: data.value,
      })
    }

    return { success: true }
  }
})

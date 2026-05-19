import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const db = await getDatabase()

  if (method === 'GET') {
    const configs = await (db as any).select().from(schema.siteConfig)
    const result: Record<string, string> = {}
    for (const c of configs) {
      result[c.key] = c.value
    }
    return result
  }

  if (method === 'PUT') {
    requireAdmin(event)
    const body = await readBody(event)

    for (const [key, value] of Object.entries(body)) {
      const existing = await (db as any)
        .select()
        .from(schema.siteConfig)
        .where(eq(schema.siteConfig.key, key))
        .limit(1)

      if (existing.length) {
        await (db as any)
          .update(schema.siteConfig)
          .set({ value: String(value) })
          .where(eq(schema.siteConfig.key, key))
      } else {
        await (db as any).insert(schema.siteConfig).values({ key, value: String(value) })
      }
    }

    return { success: true }
  }
})

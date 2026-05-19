import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

const aiConfigSchema = z.object({
  purpose: z.enum(['generation', 'extraction', 'consistency_check', 'style_analysis']),
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  temperature: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const db = await getDatabase()

  if (method === 'GET') {
    const configs = await (db as any)
      .select()
      .from(schema.aiConfigs)
      .where(eq(schema.aiConfigs.userId, auth.userId))
    return configs
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = aiConfigSchema.parse(body)

    const existing = await (db as any)
      .select()
      .from(schema.aiConfigs)
      .where(and(eq(schema.aiConfigs.userId, auth.userId), eq(schema.aiConfigs.purpose, data.purpose)))
      .limit(1)

    if (existing.length) {
      const result = await (db as any)
        .update(schema.aiConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.aiConfigs.id, existing[0].id))
        .returning()
      return result[0]
    }

    const result = await (db as any).insert(schema.aiConfigs).values({
      userId: auth.userId,
      ...data,
    }).returning()
    return result[0]
  }
})

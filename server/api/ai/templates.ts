import { z } from 'zod'
import { eq, and, or, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  category: z.enum(['generation', 'rewrite', 'expand', 'custom']),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const db = await getDatabase()

  if (method === 'GET') {
    const templates = await (db as any)
      .select()
      .from(schema.promptTemplates)
      .where(or(
        eq(schema.promptTemplates.userId, auth.userId),
        eq(schema.promptTemplates.isSystem, true),
      ))
    return templates
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = templateSchema.parse(body)

    const result = await (db as any).insert(schema.promptTemplates).values({
      userId: auth.userId,
      name: data.name,
      content: data.content,
      category: data.category,
      isSystem: false,
    }).returning()

    return result[0]
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = parseInt(query.id as string)

    await (db as any)
      .delete(schema.promptTemplates)
      .where(and(eq(schema.promptTemplates.id, id), eq(schema.promptTemplates.userId, auth.userId)))

    return { success: true }
  }
})

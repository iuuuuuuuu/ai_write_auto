import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

const updateNovelSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  genre: z.string().max(50).optional(),
  status: z.enum(['draft', 'in_progress', 'completed']).optional(),
  styleGuide: z.string().optional(),
  worldSetting: z.string().optional(),
  aiTemperature: z.string().optional(),
  aiExtraPrompt: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = updateNovelSchema.parse(body)

  const db = await getDatabase()
  const result = await (db as any)
    .update(schema.novels)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(schema.novels.id, id), eq(schema.novels.userId, auth.userId)))
    .returning()

  if (!result.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  return result[0]
})

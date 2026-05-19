import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'

const plotPointSchema = z.object({
  description: z.string().min(1),
  type: z.enum(['setup', 'conflict', 'resolution', 'twist']),
  status: z.enum(['introduced', 'developing', 'resolved']).default('introduced'),
  chapterId: z.number().int().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = plotPointSchema.parse(body)

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.id, novelId), eq(schema.novels.userId, auth.userId)))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const result = await (db as any).insert(schema.plotPoints).values({
    novelId,
    chapterId: data.chapterId || null,
    description: data.description,
    type: data.type,
    status: data.status,
  }).returning()

  return result[0]
})

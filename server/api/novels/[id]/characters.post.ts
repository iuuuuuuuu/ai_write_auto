import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'

const characterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  traits: z.string().optional(),
  relationships: z.string().optional(),
  currentState: z.string().optional(),
  firstAppearanceChapter: z.number().int().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = characterSchema.parse(body)

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.id, novelId), eq(schema.novels.userId, auth.userId)))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const result = await (db as any).insert(schema.characters).values({
    novelId,
    name: data.name,
    description: data.description || null,
    traits: data.traits || null,
    relationships: data.relationships || null,
    currentState: data.currentState || null,
    firstAppearanceChapter: data.firstAppearanceChapter || null,
  }).returning()

  return result[0]
})

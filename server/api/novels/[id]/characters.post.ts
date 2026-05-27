import { z } from 'zod'
import { NovelSchema, CharacterSchema } from '../../../database/entities'

const characterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  traits: z.string().optional(),
  relationships: z.string().optional(),
  currentState: z.string().optional(),
  firstAppearanceChapter: z.number().int().nullable().optional(),
  lastAppearanceChapter: z.number().int().nullable().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const body = await readBody(event)
  const data = characterSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const character = em.create(CharacterSchema, {
    novel: novelId,
    name: data.name,
    description: data.description || null,
    traits: data.traits || null,
    relationships: data.relationships || null,
    currentState: data.currentState || null,
    firstAppearanceChapter: data.firstAppearanceChapter || null,
    lastAppearanceChapter: data.lastAppearanceChapter || null
  })
  await em.flush()

  return character
})

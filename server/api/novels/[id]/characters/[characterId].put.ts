import { z } from 'zod'
import { CharacterSchema, NovelSchema } from '~~/server/database/entities'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
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
  const characterId = parseIntParam(event, 'characterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const character = await em.findOne(CharacterSchema, { id: characterId, novel: novelId })
  if (!character) throw createError({ statusCode: 404, message: 'Character not found' })

  const body = await readBody(event)
  const data = updateSchema.parse(body)

  if (data.name !== undefined) character.name = data.name
  if (data.description !== undefined) character.description = data.description || null
  if (data.traits !== undefined) character.traits = data.traits || null
  if (data.relationships !== undefined) character.relationships = data.relationships || null
  if (data.currentState !== undefined) character.currentState = data.currentState || null
  if (data.firstAppearanceChapter !== undefined) character.firstAppearanceChapter = data.firstAppearanceChapter
  if (data.lastAppearanceChapter !== undefined) character.lastAppearanceChapter = data.lastAppearanceChapter

  await em.flush()
  return character
})

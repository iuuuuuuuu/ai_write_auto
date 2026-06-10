import { z } from 'zod'
import { NovelSchema, CharacterSchema } from '../../../database/entities'

const batchSchema = z.object({
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        traits: z.string().optional(),
        relationships: z.string().optional(),
        currentState: z.string().optional(),
        realName: z.string().optional(),
        displayTitle: z.string().optional(),
        rolePosition: z.string().optional(),
        storyRole: z.string().optional()
      })
    )
    .min(1)
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const body = await readBody(event)
  const data = batchSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const existingNames = (
    await em.find(CharacterSchema, { novel: novelId })
  ).map((c) => c.name)
  const created = []

  for (const item of data.characters) {
    if (existingNames.includes(item.name)) continue
    const character = em.create(CharacterSchema, {
      novel: novelId,
      name: item.name,
      description: item.description || null,
      traits: item.traits || null,
      relationships: item.relationships || null,
      currentState: item.currentState || null,
      realName: item.realName || null,
      displayTitle: item.displayTitle || null,
      rolePosition: item.rolePosition || null,
      storyRole: item.storyRole || null
    })
    created.push(character)
  }

  await em.flush()
  return { created: created.length }
})

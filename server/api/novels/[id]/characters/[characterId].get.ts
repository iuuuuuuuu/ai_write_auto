import { CharacterSchema, NovelSchema } from '~~/server/database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const characterId = parseInt(getRouterParam(event, 'characterId')!)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const character = await em.findOne(CharacterSchema, { id: characterId, novel: novelId })
  if (!character) throw createError({ statusCode: 404, message: 'Character not found' })

  return character
})

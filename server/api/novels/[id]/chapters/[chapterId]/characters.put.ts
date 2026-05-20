import { z } from 'zod'
import { ChapterCharacterSchema, ChapterSchema, CharacterSchema, NovelSchema } from '~~/server/database/entities'

const schema = z.object({
  characters: z.array(z.object({
    characterId: z.number().int(),
    role: z.enum(['main', 'supporting', 'mentioned']).default('supporting'),
  }))
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const chapterId = parseInt(getRouterParam(event, 'chapterId')!)
  const body = await readBody(event)
  const data = schema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(ChapterSchema, { id: chapterId, novel: novelId })
  if (!chapter) throw createError({ statusCode: 404, message: 'Chapter not found' })

  // Remove existing assignments
  const existing = await em.find(ChapterCharacterSchema, { chapter: chapterId })
  for (const item of existing) {
    em.remove(item)
  }

  // Create new assignments
  for (const { characterId, role } of data.characters) {
    const character = await em.findOne(CharacterSchema, { id: characterId, novel: novelId })
    if (!character) continue
    em.create(ChapterCharacterSchema, {
      chapter: chapterId,
      character: characterId,
      role,
    })
  }

  await em.flush()
  return { success: true }
})

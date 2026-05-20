import { ChapterCharacterSchema, ChapterSchema, CharacterSchema, NovelSchema } from '~~/server/database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const chapterId = parseInt(getRouterParam(event, 'chapterId')!)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(ChapterSchema, { id: chapterId, novel: novelId })
  if (!chapter) throw createError({ statusCode: 404, message: 'Chapter not found' })

  const assignments = await em.find(ChapterCharacterSchema, { chapter: chapterId }, {
    populate: ['character']
  })

  return assignments.map(a => ({
    id: a.id,
    characterId: (a.character as any).id,
    characterName: (a.character as any).name,
    characterDescription: (a.character as any).description,
    role: a.role,
  }))
})

import {
  ChapterCharacterSchema,
  ChapterSchema,
  CharacterAppearanceSchema,
  NovelSchema
} from '~~/server/database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(ChapterSchema, {
    id: chapterId,
    novel: novelId
  })
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })

  const assignments = await em.find(
    ChapterCharacterSchema,
    { chapter: chapterId },
    {
      populate: ['character']
    }
  )

  const appearances = await em.find(
    CharacterAppearanceSchema,
    { chapter: chapterId },
    {
      populate: ['character']
    }
  )

  return assignments.map((a) => ({
    id: a.id,
    characterId: a.character.id,
    characterName: a.character.name,
    characterDescription: a.character.description,
    role: a.role,
    appearances: appearances
      .filter((appearance) => appearance.character.id === a.character.id)
      .map((appearance) => ({
        id: appearance.id,
        snippet: appearance.snippet,
        background: appearance.background,
        role: appearance.role,
        positionStart: appearance.positionStart,
        positionEnd: appearance.positionEnd
      }))
  }))
})

import {
  NovelSchema,
  CharacterSchema,
  CharacterAppearanceSchema,
  ChapterCharacterSchema
} from '../../../database/entities'
import { buildCharacterAppearancePayload } from '../../../utils/character-appearances'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const characters = await em.find(CharacterSchema, { novel: novelId })
  const appearances = await em.find(
    CharacterAppearanceSchema,
    { novel: novelId },
    {
      populate: ['chapter', 'character'],
      orderBy: { id: 'ASC' }
    }
  )
  const assignments = await em.find(
    ChapterCharacterSchema,
    { chapter: { novel: novelId } },
    {
      populate: ['chapter', 'character'],
      orderBy: { id: 'ASC' }
    }
  )

  return characters.map((character) => {
    const appearancePayload = buildCharacterAppearancePayload(character, {
      appearances,
      assignments
    })

    return {
      id: character.id,
      name: character.name,
      description: character.description,
      traits: character.traits,
      relationships: character.relationships,
      currentState: character.currentState,
      realName: character.realName,
      displayTitle: character.displayTitle,
      rolePosition: character.rolePosition,
      storyRole: character.storyRole,
      overallArc: character.overallArc,
      firstAppearanceChapter: appearancePayload.firstAppearanceChapter,
      lastAppearanceChapter: appearancePayload.lastAppearanceChapter,
      createdAt: character.createdAt,
      appearances: appearancePayload.appearances
    }
  })
})

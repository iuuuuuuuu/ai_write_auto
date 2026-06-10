import {
  NovelSchema,
  CharacterSchema,
  CharacterAppearanceSchema,
  ChapterCharacterSchema
} from '../../../database/entities'

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
    const appearanceItems = appearances
      .filter((appearance) => appearance.character.id === character.id)
      .map((appearance) => ({
        id: appearance.id,
        chapterId: appearance.chapter.id,
        chapterNumber: appearance.chapter.chapterNumber,
        chapterTitle: appearance.chapter.title,
        role: appearance.role,
        snippet: appearance.snippet,
        background: appearance.background,
        positionStart: appearance.positionStart,
        positionEnd: appearance.positionEnd,
        createdAt: appearance.createdAt
      }))

    const appearanceChapterIds = new Set(
      appearanceItems.map((appearance) => appearance.chapterId)
    )
    const assignmentItems = assignments
      .filter(
        (assignment) =>
          assignment.character.id === character.id &&
          !appearanceChapterIds.has(assignment.chapter.id)
      )
      .map((assignment) => ({
        id: assignment.id,
        chapterId: assignment.chapter.id,
        chapterNumber: assignment.chapter.chapterNumber,
        chapterTitle: assignment.chapter.title,
        role: assignment.role,
        chapterStory: assignment.chapterStory,
        snippet: null,
        background: null,
        positionStart: null,
        positionEnd: null,
        createdAt: null
      }))

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
      firstAppearanceChapter: character.firstAppearanceChapter,
      lastAppearanceChapter: character.lastAppearanceChapter,
      createdAt: character.createdAt,
      appearances: [...appearanceItems, ...assignmentItems].sort(
        (left, right) => left.chapterNumber - right.chapterNumber
      )
    }
  })
})

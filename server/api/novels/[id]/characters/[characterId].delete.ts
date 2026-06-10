import {
  CharacterSchema,
  NovelSchema,
  CharacterAppearanceSchema,
  ChapterCharacterSchema,
  CharacterStateChangeSchema,
  CharacterStateSnapshotSchema
} from '~~/server/database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const characterId = parseIntParam(event, 'characterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const character = await em.findOne(CharacterSchema, {
    id: characterId,
    novel: novelId
  })
  if (!character)
    throw createError({ statusCode: 404, message: 'Character not found' })

  const appearanceCount = await em.count(CharacterAppearanceSchema, {
    character: characterId
  })
  const assignmentCount = await em.count(ChapterCharacterSchema, {
    character: characterId
  })
  const stateChangeCount = await em.count(CharacterStateChangeSchema, {
    $or: [{ character: characterId }, { relatedCharacter: characterId }]
  })
  const snapshotCount = await em.count(CharacterStateSnapshotSchema, {
    character: characterId
  })

  if (
    appearanceCount > 0 ||
    assignmentCount > 0 ||
    stateChangeCount > 0 ||
    snapshotCount > 0
  ) {
    throw createError({
      statusCode: 409,
      message: `无法删除角色「${character.name}」：该角色仍有关联数据（章节 ${assignmentCount} 个、出场片段 ${appearanceCount} 条、变化记录 ${stateChangeCount} 条）。请先移除相关章节中的角色关联或变化记录。`
    })
  }

  em.remove(character)
  await em.flush()
  return { success: true }
})

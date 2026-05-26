import {
  CharacterSchema,
  NovelSchema,
  CharacterAppearanceSchema,
  ChapterCharacterSchema
} from '~~/server/database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const characterId = parseInt(getRouterParam(event, 'characterId')!)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const character = await em.findOne(CharacterSchema, { id: characterId, novel: novelId })
  if (!character) throw createError({ statusCode: 404, message: 'Character not found' })

  const appearanceCount = await em.count(CharacterAppearanceSchema, { character: characterId })
  const assignmentCount = await em.count(ChapterCharacterSchema, { character: characterId })

  if (appearanceCount > 0 || assignmentCount > 0) {
    throw createError({
      statusCode: 409,
      message: `无法删除角色「${character.name}」：该角色在 ${assignmentCount} 个章节中有出场记录，共 ${appearanceCount} 条出场片段。请先移除相关章节中的角色关联。`
    })
  }

  em.remove(character)
  await em.flush()
  return { success: true }
})

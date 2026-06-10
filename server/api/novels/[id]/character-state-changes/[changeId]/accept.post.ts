import {
  CharacterStateChangeSchema,
  NovelSchema
} from '~~/server/database/entities'
import {
  CHARACTER_STATE_CHANGE_STATUS,
  setCharacterStateChangeStatus
} from '~~/server/services/character-state-changes'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const changeId = parseIntParam(event, 'changeId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId,
    deletedAt: null
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const change = await em.findOne(CharacterStateChangeSchema, {
    id: changeId,
    novel: novelId
  })
  if (!change)
    throw createError({ statusCode: 404, message: 'Change not found' })

  return setCharacterStateChangeStatus(
    em,
    changeId,
    CHARACTER_STATE_CHANGE_STATUS.ACCEPTED
  )
})

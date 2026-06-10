import { z } from 'zod'
import {
  CharacterStateChangeSchema,
  NovelSchema
} from '~~/server/database/entities'
import {
  CHARACTER_STATE_CHANGE_TYPES,
  updateCharacterStateChange
} from '~~/server/services/character-state-changes'

const bodySchema = z.object({
  relatedCharacterId: z.number().int().positive().nullable().optional(),
  changeType: z.enum(CHARACTER_STATE_CHANGE_TYPES).optional(),
  beforeValue: z.string().nullable().optional(),
  afterValue: z.string().min(1).optional(),
  reason: z.string().nullable().optional(),
  evidenceQuote: z.string().nullable().optional(),
  status: z.enum(['pending', 'accepted', 'rejected', 'reverted']).optional()
})

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

  const body = await readBody(event)
  const data = bodySchema.parse(body)
  return updateCharacterStateChange(em, changeId, data)
})

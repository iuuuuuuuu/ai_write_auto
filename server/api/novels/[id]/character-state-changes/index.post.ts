import { z } from 'zod'
import { NovelSchema } from '~~/server/database/entities'
import {
  CHARACTER_STATE_CHANGE_TYPES,
  createManualCharacterStateChange
} from '~~/server/services/character-state-changes'

const bodySchema = z.object({
  chapterId: z.number().int().positive(),
  characterId: z.number().int().positive(),
  relatedCharacterId: z.number().int().positive().nullable().optional(),
  changeType: z.enum(CHARACTER_STATE_CHANGE_TYPES),
  beforeValue: z.string().nullable().optional(),
  afterValue: z.string().min(1),
  reason: z.string().nullable().optional(),
  evidenceQuote: z.string().nullable().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId,
    deletedAt: null
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const body = await readBody(event)
  const data = bodySchema.parse(body)
  return createManualCharacterStateChange(em, {
    novelId,
    chapterId: data.chapterId,
    characterId: data.characterId,
    relatedCharacterId: data.relatedCharacterId,
    changeType: data.changeType,
    beforeValue: data.beforeValue,
    afterValue: data.afterValue,
    reason: data.reason,
    evidenceQuote: data.evidenceQuote
  })
})

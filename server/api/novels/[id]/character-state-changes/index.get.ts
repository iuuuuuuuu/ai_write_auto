import { z } from 'zod'
import { NovelSchema } from '~~/server/database/entities'
import { listCharacterStateChanges } from '~~/server/services/character-state-changes'

const querySchema = z.object({
  characterId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'accepted', 'rejected', 'reverted']).optional()
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

  const query = querySchema.parse(getQuery(event))
  return listCharacterStateChanges(em, {
    novelId,
    characterId: query.characterId,
    chapterId: query.chapterId,
    status: query.status
  })
})

import { z } from 'zod'
import { extractCharacterStateChangesForChapter } from '~~/server/services/character-state-changes'

const bodySchema = z.object({
  replaceAi: z.boolean().optional().default(true)
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const em = useEm(event)
  const body = await readBody(event)
  const data = bodySchema.parse(body || {})

  return extractCharacterStateChangesForChapter(em, {
    userId: auth.userId,
    novelId,
    chapterId,
    replaceAi: data.replaceAi
  })
})

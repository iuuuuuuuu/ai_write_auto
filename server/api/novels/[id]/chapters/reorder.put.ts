import { z } from 'zod'
import { NovelSchema, ChapterSchema } from '../../../../database/entities'

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { orderedIds } = reorderSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  for (let i = 0; i < orderedIds.length; i++) {
    const chapterId = orderedIds[i]!
    await em.nativeUpdate(ChapterSchema, { id: chapterId, novel: novelId }, { chapterNumber: i + 1, updatedAt: new Date() })
  }

  return { success: true }
})

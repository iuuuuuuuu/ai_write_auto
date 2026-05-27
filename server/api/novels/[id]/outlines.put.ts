import { z } from 'zod'
import { NovelSchema, NovelOutlineSchema } from '../../../database/entities'

const outlineSchema = z.object({
  outlines: z.array(z.object({
    chapterNumber: z.number().int().positive(),
    description: z.string().min(1),
    sortOrder: z.number().int(),
  })),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const body = await readBody(event)
  const data = outlineSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  await em.nativeDelete(NovelOutlineSchema, { novel: novelId })

  if (data.outlines.length > 0) {
    for (const o of data.outlines) {
      em.create(NovelOutlineSchema, {
        novel: novelId,
        chapterNumber: o.chapterNumber,
        description: o.description,
        sortOrder: o.sortOrder,
      })
    }
    await em.flush()
  }

  return { success: true }
})

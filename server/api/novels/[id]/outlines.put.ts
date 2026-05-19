import { z } from 'zod'

const outlineSchema = z.object({
  outlines: z.array(z.object({
    chapterNumber: z.number().int().positive(),
    description: z.string().min(1),
    sortOrder: z.number().int(),
  })),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = outlineSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  await em.nativeDelete('NovelOutline', { novel: novelId })

  if (data.outlines.length > 0) {
    for (const o of data.outlines) {
      em.create('NovelOutline', {
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

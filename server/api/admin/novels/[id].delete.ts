import { NovelSchema, ChapterSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseIntParam(event, 'id')

  const novel = await em.findOne(NovelSchema, { id })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  novel.deletedAt = new Date()
  await em.nativeUpdate(ChapterSchema, { novel: id }, { deletedAt: new Date() })
  await em.flush()

  return { success: true }
})

import { NovelSchema, PlotPointSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const plotPoints = await em.find(
    PlotPointSchema,
    { novel: novelId },
    { populate: ['chapter'], orderBy: { createdAt: 'ASC' } }
  )

  return plotPoints.map((point) => {
    const chapter = point.chapter
    const isActiveChapter = chapter && !chapter.deletedAt
    return {
      id: point.id,
      description: point.description,
      type: point.type,
      status: point.status,
      chapterId: isActiveChapter ? chapter.id : null,
      createdAt: point.createdAt
    }
  })
})

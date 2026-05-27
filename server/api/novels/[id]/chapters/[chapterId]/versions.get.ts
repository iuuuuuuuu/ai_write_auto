import { NovelSchema, ChapterVersionSchema } from '../../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const versions = await em.find(ChapterVersionSchema, { chapter: chapterId }, { orderBy: { versionNumber: 'ASC' } })

  return versions
})

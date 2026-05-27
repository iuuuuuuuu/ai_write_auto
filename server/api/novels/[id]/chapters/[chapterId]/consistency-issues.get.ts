import { ConsistencyIssueSchema, ChapterSchema, NovelSchema } from '../../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const chapter = await em.findOne(ChapterSchema, { id: chapterId, novel: novelId })
  if (!chapter) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }

  const issues = await em.find(ConsistencyIssueSchema, {
    chapter: chapterId,
    dismissed: false
  }, { orderBy: { createdAt: 'DESC' } })

  return issues.map((issue: any) => ({
    id: issue.id,
    type: issue.type,
    severity: issue.severity,
    description: issue.description,
    createdAt: issue.createdAt
  }))
})

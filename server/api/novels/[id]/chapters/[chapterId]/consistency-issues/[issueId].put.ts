import { z } from 'zod'
import { ConsistencyIssueSchema, NovelSchema } from '../../../../../../database/entities'

const dismissSchema = z.object({
  dismissed: z.boolean()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const issueId = parseIntParam(event, 'issueId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const body = await readBody(event)
  const data = dismissSchema.parse(body)

  const issue = await em.findOne(ConsistencyIssueSchema, { id: issueId })
  if (!issue) {
    throw createError({ statusCode: 404, message: 'Issue not found' })
  }

  await em.nativeUpdate(ConsistencyIssueSchema, { id: issueId }, { dismissed: data.dismissed })

  return { success: true }
})

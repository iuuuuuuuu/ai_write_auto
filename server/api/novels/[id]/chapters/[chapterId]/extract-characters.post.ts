import { ChapterSchema, NovelSchema } from '~~/server/database/entities'
import {
  enqueuePostProcessing,
  processPendingTasks
} from '~~/server/services/task-queue'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(ChapterSchema, {
    id: chapterId,
    novel: novelId,
    deletedAt: null
  })
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })

  await enqueuePostProcessing(novelId, chapterId)
  await processPendingTasks()

  return { success: true }
})

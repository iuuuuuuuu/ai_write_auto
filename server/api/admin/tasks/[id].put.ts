import { GenerationTaskSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const { action } = body

  const task = await em.findOne(GenerationTaskSchema, { id })
  if (!task) {
    throw createError({ statusCode: 404, message: 'Task not found' })
  }

  if (action === 'retry') {
    if (task.status !== 'failed') {
      throw createError({ statusCode: 400, message: 'Only failed tasks can be retried' })
    }
    task.status = 'pending'
    task.error = null
    task.retryCount = (task.retryCount || 0) + 1
    await em.flush()
    return { success: true }
  }

  if (action === 'cancel') {
    if (task.status !== 'pending' && task.status !== 'running') {
      throw createError({ statusCode: 400, message: 'Only pending/running tasks can be cancelled' })
    }
    task.status = 'failed'
    task.error = 'Cancelled by admin'
    await em.flush()
    return { success: true }
  }

  throw createError({ statusCode: 400, message: 'Invalid action' })
})

import { z } from 'zod'
import { GenerationTaskSchema } from '../../../database/entities'

const taskActionSchema = z.object({
  action: z.enum(['retry', 'pause', 'resume', 'cancel']),
})

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseIntParam(event, 'id')
  const body = await readBody(event)
  const { action } = taskActionSchema.parse(body)

  const task = await em.findOne(GenerationTaskSchema, { id })
  if (!task) {
    throw createError({ statusCode: 404, message: 'Task not found' })
  }

  if (action === 'retry') {
    if (task.status !== 'failed' && task.status !== 'cancelled') {
      throw createError({ statusCode: 400, message: 'Only failed/cancelled tasks can be retried' })
    }
    task.status = 'pending'
    task.error = null
    task.retryCount = (task.retryCount || 0) + 1
    task.completedAt = null
    await em.flush()
    return { success: true }
  }

  if (action === 'pause') {
    if (task.status !== 'running') {
      throw createError({ statusCode: 400, message: 'Only running tasks can be paused' })
    }
    task.status = 'paused'
    await em.flush()
    return { success: true }
  }

  if (action === 'resume') {
    if (task.status !== 'paused') {
      throw createError({ statusCode: 400, message: 'Only paused tasks can be resumed' })
    }
    task.status = 'running'
    await em.flush()
    return { success: true }
  }

  if (action === 'cancel') {
    if (task.status !== 'pending' && task.status !== 'running' && task.status !== 'paused') {
      throw createError({ statusCode: 400, message: 'Only pending/running/paused tasks can be cancelled' })
    }
    task.status = 'cancelled'
    task.error = 'Cancelled by admin'
    task.completedAt = new Date()
    await em.flush()
    return { success: true }
  }

  throw createError({ statusCode: 400, message: 'Invalid action' })
})

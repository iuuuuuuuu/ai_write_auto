import { GenerationTaskSchema, NovelSchema } from '../../database/entities'
import type { GenerationTask } from '../../database/entities'

type TaskStatus = GenerationTask['status']
type TaskFilter = Partial<{
  status: TaskStatus
  type: string
}>

function getEntityId(entity: unknown): number {
  if (typeof entity === 'number') return entity
  if (entity && typeof entity === 'object' && 'id' in entity) {
    return Number((entity as { id: unknown }).id)
  }
  return Number(entity)
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === 'pending' ||
    value === 'running' ||
    value === 'paused' ||
    value === 'cancelled' ||
    value === 'completed' ||
    value === 'failed'
  )
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)

  const status = typeof query.status === 'string' ? query.status : ''
  const type = typeof query.type === 'string' ? query.type : ''

  const filter: TaskFilter = {}
  if (isTaskStatus(status)) filter.status = status
  if (type && type !== 'all') filter.type = type

  const [tasks, total] = await Promise.all([
    em.find(GenerationTaskSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { createdAt: 'DESC' },
    }),
    em.count(GenerationTaskSchema, filter),
  ])

  const novelIds = [...new Set(tasks.map((task) => getEntityId(task.novel)))]
  const novels = novelIds.length ? await em.find(NovelSchema, { id: { $in: novelIds } }) : []
  const novelsById = new Map(novels.map((n) => [n.id, { id: n.id, title: n.title }]))

  const items = tasks.map((task) => ({
    ...task,
    novel: novelsById.get(getEntityId(task.novel)) || null,
  }))

  const statusCounts = await Promise.all([
    em.count(GenerationTaskSchema, { status: 'pending' }),
    em.count(GenerationTaskSchema, { status: 'running' }),
    em.count(GenerationTaskSchema, { status: 'paused' }),
    em.count(GenerationTaskSchema, { status: 'cancelled' }),
    em.count(GenerationTaskSchema, { status: 'completed' }),
    em.count(GenerationTaskSchema, { status: 'failed' }),
  ])

  return {
    ...paginatedResult(items, total, pagination),
    statusCounts: {
      pending: statusCounts[0],
      running: statusCounts[1],
      paused: statusCounts[2],
      cancelled: statusCounts[3],
      completed: statusCounts[4],
      failed: statusCounts[5],
    },
  }
})

import { GenerationTaskSchema, NovelSchema, UserSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)

  const status = query.status as string || ''
  const type = query.type as string || ''

  const filter: Record<string, any> = {}
  if (status && status !== 'all') filter.status = status
  if (type && type !== 'all') filter.type = type

  const [tasks, total] = await Promise.all([
    em.find(GenerationTaskSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { createdAt: 'DESC' },
    }),
    em.count(GenerationTaskSchema, filter),
  ])

  const novelIds = [...new Set(tasks.map((t) => t.novel as any))]
  const novels = novelIds.length ? await em.find(NovelSchema, { id: { $in: novelIds } }) : []
  const novelsById = new Map(novels.map((n) => [n.id, { id: n.id, title: n.title }]))

  const items = tasks.map((task) => ({
    ...task,
    novel: novelsById.get(task.novel as any) || null,
  }))

  const statusCounts = await Promise.all([
    em.count(GenerationTaskSchema, { status: 'pending' }),
    em.count(GenerationTaskSchema, { status: 'running' }),
    em.count(GenerationTaskSchema, { status: 'completed' }),
    em.count(GenerationTaskSchema, { status: 'failed' }),
  ])

  return {
    ...paginatedResult(items, total, pagination),
    statusCounts: {
      pending: statusCounts[0],
      running: statusCounts[1],
      completed: statusCounts[2],
      failed: statusCounts[3],
    },
  }
})

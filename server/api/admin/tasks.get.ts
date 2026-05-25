import { GenerationTaskSchema, NovelSchema, ChapterSchema } from '../../database/entities'
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
  const userIdFilter = query.userId ? parseInt(query.userId as string) : null

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
  const novels = novelIds.length ? await em.find(NovelSchema, { id: { $in: novelIds } }, { populate: ['user'] }) : []
  const novelsById = new Map(novels.map((n) => [n.id, n]))

  const chapterIds = tasks.map(t => t.chapter ? getEntityId(t.chapter) : null).filter(Boolean) as number[]
  const chapters = chapterIds.length ? await em.find(ChapterSchema, { id: { $in: chapterIds } }) : []
  const chaptersById = new Map(chapters.map(c => [c.id, c]))

  let items = tasks.map((task) => {
    const novel = novelsById.get(getEntityId(task.novel))
    const user = novel?.user as any
    const chapter = task.chapter ? chaptersById.get(getEntityId(task.chapter)) : null
    return {
      ...task,
      novel: novel ? { id: novel.id, title: novel.title } : null,
      chapter: chapter ? { id: chapter.id, title: chapter.title, chapterNumber: chapter.chapterNumber } : null,
      username: user?.username || null,
      userId: user?.id || null,
    }
  })

  if (userIdFilter) {
    items = items.filter(item => item.userId === userIdFilter)
  }

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

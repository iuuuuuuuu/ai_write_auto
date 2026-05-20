import { NovelSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)

  const search = (query.search as string || '').trim()
  const status = query.status as string || ''

  const filter: Record<string, any> = {
    user: auth.userId,
    deletedAt: null,
  }
  if (search) {
    filter.title = { $like: `%${search}%` }
  }
  if (status && status !== 'all') {
    filter.status = status
  }

  const [novels, total] = await Promise.all([
    em.find(NovelSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { updatedAt: 'DESC' },
    }),
    em.count(NovelSchema, filter),
  ])

  return paginatedResult(novels, total, pagination)
})

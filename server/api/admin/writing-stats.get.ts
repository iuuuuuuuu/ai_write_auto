import { WritingStatSchema, UserSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)

  const days = parseInt((query.days as string) || '30')
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const filter: Record<string, any> = { date: { $gte: sinceStr } }

  const [stats, total] = await Promise.all([
    em.find(WritingStatSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { date: 'DESC' },
    }),
    em.count(WritingStatSchema, filter),
  ])

  const userIds = [...new Set(stats.map((s) => s.user as any))]
  const users = userIds.length ? await em.find(UserSchema, { id: { $in: userIds } }) : []
  const usersById = new Map(users.map((u) => [u.id, { id: u.id, username: u.username }]))

  const allStats = await em.find(WritingStatSchema, filter)
  const totalWords = allStats.reduce((sum, s) => sum + (s.wordsWritten || 0), 0)
  const totalChapters = allStats.reduce((sum, s) => sum + (s.chaptersCompleted || 0), 0)
  const totalGenerations = allStats.reduce((sum, s) => sum + (s.aiGenerations || 0), 0)

  const items = stats.map((s) => ({
    ...s,
    user: usersById.get(s.user as any) || null,
  }))

  return {
    ...paginatedResult(items, total, pagination),
    summary: { totalWords, totalChapters, totalGenerations },
  }
})

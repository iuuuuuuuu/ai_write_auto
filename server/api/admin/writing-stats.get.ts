import { WritingStatSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)

  const days = parseInt((query.days as string) || '30')
  const userId = query.userId ? parseInt(query.userId as string) : null
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const filter: Record<string, any> = { date: { $gte: sinceStr } }
  if (userId) filter.user = userId

  const [stats, total] = await Promise.all([
    em.find(WritingStatSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { date: 'DESC' },
      populate: ['user'],
    }),
    em.count(WritingStatSchema, filter),
  ])

  const conn = em.getConnection()
  const params: any[] = [sinceStr]
  let userCondition = ''
  if (userId) {
    userCondition = ' AND user_id = ?'
    params.push(userId)
  }
  const [sumRow] = await conn.execute(
    `SELECT COALESCE(SUM(words_written),0) as tw, COALESCE(SUM(chapters_completed),0) as tc, COALESCE(SUM(ai_generations),0) as tg FROM writing_stats WHERE date >= ?${userCondition}`,
    params
  ) as any[]

  const items = stats.map((s) => {
    const user = s.user as any
    return {
      id: s.id,
      date: s.date,
      wordsWritten: s.wordsWritten,
      chaptersCompleted: s.chaptersCompleted,
      aiGenerations: s.aiGenerations,
      username: user?.username || null,
      userId: user?.id || null,
    }
  })

  return {
    ...paginatedResult(items, total, pagination),
    summary: {
      totalWords: Number(sumRow?.tw || 0),
      totalChapters: Number(sumRow?.tc || 0),
      totalGenerations: Number(sumRow?.tg || 0),
    },
  }
})

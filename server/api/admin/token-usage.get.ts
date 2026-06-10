import { TokenUsageSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)

  const days = parseInt((query.days as string) || '30')
  const userId = query.userId ? parseInt(query.userId as string) : null

  const since = new Date()
  since.setDate(since.getDate() - days)

  const filter: Record<string, unknown> = { createdAt: { $gte: since } }
  if (userId) filter.user = userId

  const [usage, total] = await Promise.all([
    em.find(TokenUsageSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { createdAt: 'DESC' },
      populate: ['user']
    }),
    em.count(TokenUsageSchema, filter)
  ])

  const conn = em.getConnection()
  const summaryWhere = ['created_at >= ?']
  const summaryParams: Array<number> = [Math.floor(since.getTime() / 1000)]
  if (userId) {
    summaryWhere.push('user_id = ?')
    summaryParams.push(userId)
  }
  const summaryRows = await conn.execute<{
    ti: string
    to2: string
    tc: string
  }>(
    `SELECT COALESCE(SUM(tokens_input),0) as ti, COALESCE(SUM(tokens_output),0) as to2, COALESCE(SUM(CAST(estimated_cost AS REAL)),0) as tc FROM token_usage WHERE ${summaryWhere.join(' AND ')}`,
    summaryParams
  )
  const [sumRow] = Array.isArray(summaryRows) ? summaryRows : []
  const totalInput = Number(sumRow?.ti || 0)
  const totalOutput = Number(sumRow?.to2 || 0)
  const totalCost = Number(sumRow?.tc || 0)

  const items = usage.map((u) => {
    const user = u.user && typeof u.user === 'object' ? u.user : null
    return {
      id: u.id,
      tokensInput: u.tokensInput,
      tokensOutput: u.tokensOutput,
      estimatedCost: u.estimatedCost,
      createdAt: u.createdAt,
      username: user?.username || null,
      userId: user?.id || null
    }
  })

  return {
    ...paginatedResult(items, total, pagination),
    summary: {
      totalInput,
      totalOutput,
      totalTokens: totalInput + totalOutput,
      totalCost: totalCost.toFixed(4)
    }
  }
})

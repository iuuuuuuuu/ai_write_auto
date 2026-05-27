import { TokenUsageSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const days = parseInt((query.days as string) || '30')
  const em = useEm(event)
  const pagination = parsePagination(event)

  const since = new Date()
  since.setDate(since.getDate() - days)

  const filter = {
    user: auth.userId,
    createdAt: { $gte: since },
  }

  const [usage, total] = await Promise.all([
    em.find(TokenUsageSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { createdAt: 'DESC' },
    }),
    em.count(TokenUsageSchema, filter),
  ])

  const conn = em.getConnection()
  const [sumRow] = await conn.execute(
    `SELECT COALESCE(SUM(tokens_input),0) as ti, COALESCE(SUM(tokens_output),0) as "to", COALESCE(SUM(CASE WHEN estimated_cost IS NOT NULL THEN CAST(estimated_cost AS REAL) ELSE 0 END),0) as tec FROM token_usage WHERE user_id = ? AND created_at >= ?`,
    [auth.userId, Math.floor(since.getTime() / 1000)]
  ) as any[]
  const totalInput = Number(sumRow?.ti || 0)
  const totalOutput = Number(sumRow?.['to'] || 0)
  const totalEstimatedCost = Number(sumRow?.tec || 0)

  return {
    totalInput,
    totalOutput,
    totalTokens: totalInput + totalOutput,
    totalEstimatedCost: totalEstimatedCost > 0 ? totalEstimatedCost.toFixed(4) : null,
    records: total,
    ...paginatedResult(usage, total, pagination),
  }
})

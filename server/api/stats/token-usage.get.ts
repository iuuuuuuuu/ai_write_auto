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

  const allUsage = await em.find(TokenUsageSchema, filter)
  const totalInput = allUsage.reduce((sum, u) => sum + u.tokensInput, 0)
  const totalOutput = allUsage.reduce((sum, u) => sum + u.tokensOutput, 0)

  return {
    totalInput,
    totalOutput,
    totalTokens: totalInput + totalOutput,
    records: total,
    ...paginatedResult(usage, total, pagination),
  }
})

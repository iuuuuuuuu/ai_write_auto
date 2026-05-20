import { TokenUsageSchema, UserSchema, AiConfigSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)

  const days = parseInt((query.days as string) || '30')
  const userId = query.userId ? parseInt(query.userId as string) : null

  const since = new Date()
  since.setDate(since.getDate() - days)

  const filter: Record<string, any> = { createdAt: { $gte: since } }
  if (userId) filter.user = userId

  const [usage, total] = await Promise.all([
    em.find(TokenUsageSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { createdAt: 'DESC' },
    }),
    em.count(TokenUsageSchema, filter),
  ])

  const userIds = [...new Set(usage.map((u) => u.user as any))]
  const users = userIds.length ? await em.find(UserSchema, { id: { $in: userIds } }) : []
  const usersById = new Map(users.map((u) => [u.id, { id: u.id, username: u.username }]))

  const allUsage = await em.find(TokenUsageSchema, filter)
  const totalInput = allUsage.reduce((sum, u) => sum + u.tokensInput, 0)
  const totalOutput = allUsage.reduce((sum, u) => sum + u.tokensOutput, 0)
  const totalCost = allUsage.reduce((sum, u) => sum + parseFloat(u.estimatedCost || '0'), 0)

  const items = usage.map((u) => ({
    ...u,
    user: usersById.get(u.user as any) || null,
  }))

  return {
    ...paginatedResult(items, total, pagination),
    summary: {
      totalInput,
      totalOutput,
      totalTokens: totalInput + totalOutput,
      totalCost: totalCost.toFixed(4),
      totalRecords: allUsage.length,
    },
  }
})

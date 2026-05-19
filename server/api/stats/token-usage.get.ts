export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const days = parseInt((query.days as string) || '30')
  const em = useEm(event)

  const since = new Date()
  since.setDate(since.getDate() - days)

  const usage = await em.find('TokenUsage', {
    user: auth.userId,
    createdAt: { $gte: since },
  }, { orderBy: { createdAt: 'ASC' } })

  const totalInput = usage.reduce((sum: number, u: any) => sum + u.tokensInput, 0)
  const totalOutput = usage.reduce((sum: number, u: any) => sum + u.tokensOutput, 0)

  return {
    totalInput,
    totalOutput,
    totalTokens: totalInput + totalOutput,
    records: usage.length,
    usage,
  }
})

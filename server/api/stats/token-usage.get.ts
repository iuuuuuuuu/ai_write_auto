import { eq, and, gte } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const days = parseInt((query.days as string) || '30')

  const db = await getDatabase()

  const since = new Date()
  since.setDate(since.getDate() - days)

  const usage = await (db as any)
    .select()
    .from(schema.tokenUsage)
    .where(and(
      eq(schema.tokenUsage.userId, auth.userId),
      gte(schema.tokenUsage.createdAt, since),
    ))
    .orderBy(schema.tokenUsage.createdAt)

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

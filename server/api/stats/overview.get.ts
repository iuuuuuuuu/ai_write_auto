import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.userId, auth.userId), isNull(schema.novels.deletedAt)))

  const totalWords = novels.reduce((sum: number, n: any) => sum + (n.wordCount || 0), 0)

  const today: string = new Date().toISOString().split('T')[0]!
  const todayStats = await (db as any)
    .select()
    .from(schema.writingStats)
    .where(and(eq(schema.writingStats.userId, auth.userId), eq(schema.writingStats.date, today)))
    .limit(1)

  return {
    todayWords: todayStats[0]?.wordsWritten || 0,
    streak: 0,
    totalNovels: novels.length,
    totalWords,
  }
})

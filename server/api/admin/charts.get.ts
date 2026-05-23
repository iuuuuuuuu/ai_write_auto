import {
  TokenUsageSchema,
  UserSchema,
  WritingStatSchema,
  GenerationTaskSchema
} from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)

  const days = Math.min(parseInt((query.days as string) || '7'), 90)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const dateRange = Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return d.toISOString().split('T')[0]
  })

  const [tokenRecords, writingRecords, users, tasks] = await Promise.all([
    em.find(TokenUsageSchema, { createdAt: { $gte: since } }),
    em.find(WritingStatSchema, { date: { $gte: since.toISOString().split('T')[0] } }),
    em.find(UserSchema, { createdAt: { $gte: since } }),
    em.find(GenerationTaskSchema, { createdAt: { $gte: since } }),
  ])

  const tokenByDate = new Map<string, { input: number; output: number }>()
  for (const r of tokenRecords) {
    const date = new Date(r.createdAt).toISOString().split('T')[0]
    const entry = tokenByDate.get(date) || { input: 0, output: 0 }
    entry.input += r.tokensInput
    entry.output += r.tokensOutput
    tokenByDate.set(date, entry)
  }

  const writingByDate = new Map<string, { words: number; chapters: number; generations: number }>()
  for (const r of writingRecords) {
    const date = r.date
    const entry = writingByDate.get(date) || { words: 0, chapters: 0, generations: 0 }
    entry.words += r.wordsWritten || 0
    entry.chapters += r.chaptersCompleted || 0
    entry.generations += r.aiGenerations || 0
    writingByDate.set(date, entry)
  }

  const userByDate = new Map<string, number>()
  for (const u of users) {
    const date = new Date(u.createdAt).toISOString().split('T')[0]
    userByDate.set(date, (userByDate.get(date) || 0) + 1)
  }

  const taskByDate = new Map<string, { completed: number; failed: number }>()
  for (const t of tasks) {
    const date = new Date(t.createdAt).toISOString().split('T')[0]
    const entry = taskByDate.get(date) || { completed: 0, failed: 0 }
    if (t.status === 'completed') entry.completed++
    else if (t.status === 'failed') entry.failed++
    taskByDate.set(date, entry)
  }

  return {
    tokenUsage: dateRange.map(date => ({
      date,
      input: tokenByDate.get(date)?.input || 0,
      output: tokenByDate.get(date)?.output || 0,
    })),
    writingStats: dateRange.map(date => ({
      date,
      words: writingByDate.get(date)?.words || 0,
      chapters: writingByDate.get(date)?.chapters || 0,
      generations: writingByDate.get(date)?.generations || 0,
    })),
    userGrowth: dateRange.map(date => ({
      date,
      count: userByDate.get(date) || 0,
    })),
    taskStats: dateRange.map(date => ({
      date,
      completed: taskByDate.get(date)?.completed || 0,
      failed: taskByDate.get(date)?.failed || 0,
    })),
  }
})

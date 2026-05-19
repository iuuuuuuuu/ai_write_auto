export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)

  const novels = await em.find('Novel', { user: auth.userId, deletedAt: null })
  const totalWords = novels.reduce((sum: number, n: any) => sum + (n.wordCount || 0), 0)

  const today: string = new Date().toISOString().split('T')[0]!
  const todayStats = await em.findOne('WritingStat', { user: auth.userId, date: today })

  return {
    todayWords: (todayStats as any)?.wordsWritten || 0,
    streak: 0,
    totalNovels: novels.length,
    totalWords,
  }
})

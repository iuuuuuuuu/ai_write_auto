import { NovelSchema, ChapterSchema, WritingStatSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)

  const novels = await em.find(NovelSchema, { user: auth.userId, deletedAt: null })
  const chapters = await em.find(ChapterSchema, { novel: { user: auth.userId }, deletedAt: null })
  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0)

  const today: string = new Date().toISOString().split('T')[0]!
  const todayStats = await em.findOne(WritingStatSchema, { user: auth.userId, date: today })

  return {
    todayWords: todayStats?.wordsWritten || 0,
    streak: 0,
    totalNovels: novels.length,
    totalWords,
  }
})

import { NovelSchema, ChapterSchema, WritingStatSchema, UserPreferenceSchema } from '../../database/entities'
import { calculateStreak } from '../../utils/writing-stats'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)

  const novels = await em.find(NovelSchema, { user: auth.userId, deletedAt: null })
  const chapters = await em.find(ChapterSchema, { novel: { user: auth.userId }, deletedAt: null })
  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0)

  const today: string = new Date().toISOString().split('T')[0]!
  const todayStats = await em.findOne(WritingStatSchema, { user: auth.userId, date: today })
  const prefs = await em.find(UserPreferenceSchema, { user: auth.userId })
  const prefMap = new Map(prefs.map((pref) => [pref.key, pref.value]))
  const dailyGoal = Number(prefMap.get('writing_daily_goal') || 2000)
  const chapterGoal = Number(prefMap.get('writing_chapter_goal') || 3000)
  const todayWords = todayStats?.wordsWritten || 0

  const streak = await calculateStreak(em, auth.userId)

  return {
    todayWords,
    dailyGoal,
    dailyProgress: dailyGoal > 0 ? Math.min(Math.round((todayWords / dailyGoal) * 100), 100) : 0,
    chapterGoal,
    streak,
    totalNovels: novels.length,
    totalWords,
  }
})

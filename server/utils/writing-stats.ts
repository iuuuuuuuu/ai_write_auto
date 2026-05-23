import type { EntityManager } from '@mikro-orm/core'
import { WritingStatSchema } from '../database/entities'

function getToday(): string {
  return new Date().toISOString().split('T')[0]!
}

export async function recordWordsWritten(
  em: EntityManager,
  userId: number,
  wordsDelta: number
) {
  if (wordsDelta <= 0) return
  const date = getToday()
  let stat = await em.findOne(WritingStatSchema, { user: userId, date })
  if (stat) {
    stat.wordsWritten = (stat.wordsWritten || 0) + wordsDelta
  } else {
    stat = em.create(WritingStatSchema, {
      user: userId,
      date,
      wordsWritten: wordsDelta,
      chaptersCompleted: 0,
      aiGenerations: 0
    })
  }
  await em.flush()
}

export async function recordAiGeneration(em: EntityManager, userId: number) {
  const date = getToday()
  let stat = await em.findOne(WritingStatSchema, { user: userId, date })
  if (stat) {
    stat.aiGenerations = (stat.aiGenerations || 0) + 1
  } else {
    stat = em.create(WritingStatSchema, {
      user: userId,
      date,
      wordsWritten: 0,
      chaptersCompleted: 0,
      aiGenerations: 1
    })
  }
  await em.flush()
}

export async function recordChapterCompleted(
  em: EntityManager,
  userId: number
) {
  const date = getToday()
  let stat = await em.findOne(WritingStatSchema, { user: userId, date })
  if (stat) {
    stat.chaptersCompleted = (stat.chaptersCompleted || 0) + 1
  } else {
    stat = em.create(WritingStatSchema, {
      user: userId,
      date,
      wordsWritten: 0,
      chaptersCompleted: 1,
      aiGenerations: 0
    })
  }
  await em.flush()
}

export async function calculateStreak(
  em: EntityManager,
  userId: number
): Promise<number> {
  const stats = await em.find(
    WritingStatSchema,
    { user: userId },
    { orderBy: { date: 'DESC' }, limit: 60 }
  )
  if (stats.length === 0) return 0

  const today = getToday()
  let streak = 0
  const dateSet = new Set(stats.map((s) => s.date))

  for (let i = 0; i < 60; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]!
    if (dateSet.has(dateStr)) {
      streak++
    } else {
      if (i === 0 && dateStr === today) continue
      break
    }
  }
  return streak
}

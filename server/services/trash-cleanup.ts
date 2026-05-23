import { type MikroORM } from '@mikro-orm/core'
import { Cron } from 'croner'
import {
  NovelSchema,
  ChapterSchema,
  SiteConfigSchema
} from '../database/entities'

const DEFAULT_RETENTION_DAYS = 30
const CLEANUP_CRON = '0 3 * * *'

let cleanupJob: Cron | null = null

export async function getTrashRetentionDays(orm: MikroORM): Promise<number> {
  const em = orm.em.fork()
  const entry = await em.findOne(SiteConfigSchema, {
    key: 'trash_retention_days'
  })
  const days = entry ? Number(entry.value) : DEFAULT_RETENTION_DAYS
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS
}

export async function setTrashRetentionDays(
  orm: MikroORM,
  days: number
): Promise<void> {
  const clamped = Math.max(1, Math.min(365, Math.round(days)))
  const em = orm.em.fork()
  const existing = await em.findOne(SiteConfigSchema, {
    key: 'trash_retention_days'
  })
  if (existing) {
    existing.value = String(clamped)
  } else {
    em.create(SiteConfigSchema, {
      key: 'trash_retention_days',
      value: String(clamped)
    })
  }
  await em.flush()
}

export async function runTrashCleanup(orm: MikroORM): Promise<number> {
  const retentionDays = await getTrashRetentionDays(orm)
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const em = orm.em.fork()

  const expiredNovels = await em.find(NovelSchema, {
    deletedAt: { $ne: null, $lt: cutoff }
  })

  const expiredChapters = await em.find(ChapterSchema, {
    deletedAt: { $ne: null, $lt: cutoff },
    novel: { deletedAt: null }
  })

  let cleaned = 0

  for (const novel of expiredNovels) {
    await em.nativeDelete('ChapterVersion', { chapter: { novel: novel.id } })
    await em.nativeDelete('ChapterNote', { chapter: { novel: novel.id } })
    await em.nativeDelete('ChapterCharacter', { chapter: { novel: novel.id } })
    await em.nativeDelete('ConsistencyIssue', { chapter: { novel: novel.id } })
    await em.nativeDelete('CharacterAppearance', { novel: novel.id })
    await em.nativeDelete('PlotPoint', { novel: novel.id })
    await em.nativeDelete('StoryArc', { novel: novel.id })
    await em.nativeDelete('NovelOutline', { novel: novel.id })
    await em.nativeDelete('Chapter', { novel: novel.id })
    await em.nativeDelete('Character', { novel: novel.id })
    await em.nativeDelete('GenerationTask', { novel: novel.id })
    await em.removeAndFlush(novel)
    cleaned++
  }

  for (const chapter of expiredChapters) {
    await em.nativeDelete('ChapterVersion', { chapter: chapter.id })
    await em.nativeDelete('ChapterNote', { chapter: chapter.id })
    await em.nativeDelete('ChapterCharacter', { chapter: chapter.id })
    await em.nativeDelete('ConsistencyIssue', { chapter: chapter.id })
    await em.nativeDelete('CharacterAppearance', { chapter: chapter.id })
    await em.removeAndFlush(chapter)
    cleaned++
  }

  return cleaned
}

export function startTrashCleanup(orm: MikroORM) {
  stopTrashCleanup()

  const run = async () => {
    try {
      const cleaned = await runTrashCleanup(orm)
      if (cleaned > 0) {
        console.log(`[trash-cleanup] Permanently deleted ${cleaned} expired items`)
      }
    } catch (e) {
      console.error('[trash-cleanup] Failed:', e)
    }
  }

  cleanupJob = new Cron(CLEANUP_CRON, run)
}

export function stopTrashCleanup() {
  if (cleanupJob) {
    cleanupJob.stop()
    cleanupJob = null
  }
}

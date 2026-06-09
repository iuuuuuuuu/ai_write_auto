import type { EntityManager, MikroORM } from '@mikro-orm/core'
import {
  WRITING_SKILL_SEEDS,
  WRITING_SKILL_SEED_VERSION
} from '~~/shared/writing-skills'
import { WritingSkillSchema, SiteConfigSchema } from '../database/entities'

async function upsertSkillSeedVersion(em: EntityManager) {
  const existing = await em.findOne(SiteConfigSchema, {
    key: 'writing_skill_seed_version'
  })
  if (existing) {
    existing.value = WRITING_SKILL_SEED_VERSION
    return
  }
  em.create(SiteConfigSchema, {
    key: 'writing_skill_seed_version',
    value: WRITING_SKILL_SEED_VERSION
  })
}

/**
 * 同步系统技能包（isSystem=true）：按名字匹配——存在则更新内容、缺失则创建。
 * 系统包在 UI 中只读（用户无法编辑），故直接覆盖其内容是安全的；用户自建包（isSystem=false）一律不动。
 * fewShots / checklist / appliesTo 以 JSON 字符串落库。
 */
export async function upsertWritingSkillSeeds(em: EntityManager) {
  const existing = await em.find(WritingSkillSchema, { isSystem: true })
  const byName = new Map(existing.map((s) => [s.name, s]))
  let created = 0
  let updated = 0

  for (const seed of WRITING_SKILL_SEEDS) {
    const row = byName.get(seed.name)
    if (row) {
      row.description = seed.description
      row.genre = seed.genre
      row.systemAddon = seed.systemAddon
      row.fewShots = JSON.stringify(seed.fewShots)
      row.checklist = JSON.stringify(seed.checklist)
      row.appliesTo = JSON.stringify(seed.appliesTo)
      updated += 1
    } else {
      em.create(WritingSkillSchema, {
        user: null,
        name: seed.name,
        description: seed.description,
        genre: seed.genre,
        systemAddon: seed.systemAddon,
        fewShots: JSON.stringify(seed.fewShots),
        checklist: JSON.stringify(seed.checklist),
        appliesTo: JSON.stringify(seed.appliesTo),
        isSystem: true,
        enabled: true
      })
      created += 1
    }
  }

  await upsertSkillSeedVersion(em)
  return { created, updated }
}

export async function syncWritingSkillSeeds(orm: MikroORM) {
  const em = orm.em.fork()
  const seedVersion = await em.findOne(SiteConfigSchema, {
    key: 'writing_skill_seed_version'
  })
  if (seedVersion?.value === WRITING_SKILL_SEED_VERSION) {
    return {
      created: 0,
      updated: 0,
      version: WRITING_SKILL_SEED_VERSION,
      skipped: true
    }
  }

  const { created, updated } = await upsertWritingSkillSeeds(em)
  await em.flush()

  return { created, updated, version: WRITING_SKILL_SEED_VERSION, skipped: false }
}

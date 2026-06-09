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
 * 按名字补种缺失的系统技能包（不覆盖已存在的，用户改名/删除不会被强行还原）。
 * fewShots / checklist / appliesTo 以 JSON 字符串落库。
 */
export async function createMissingWritingSkillSeeds(em: EntityManager) {
  const existing = await em.find(WritingSkillSchema, { isSystem: true })
  const existingNames = new Set(existing.map((s) => s.name))
  let created = 0

  for (const seed of WRITING_SKILL_SEEDS) {
    if (existingNames.has(seed.name)) continue
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
    existingNames.add(seed.name)
    created += 1
  }

  await upsertSkillSeedVersion(em)
  return created
}

export async function syncWritingSkillSeeds(orm: MikroORM) {
  const em = orm.em.fork()
  const seedVersion = await em.findOne(SiteConfigSchema, {
    key: 'writing_skill_seed_version'
  })
  if (seedVersion?.value === WRITING_SKILL_SEED_VERSION) {
    return { created: 0, version: WRITING_SKILL_SEED_VERSION, skipped: true }
  }

  const created = await createMissingWritingSkillSeeds(em)
  await em.flush()

  return { created, version: WRITING_SKILL_SEED_VERSION, skipped: false }
}

import type { EntityManager, MikroORM } from '@mikro-orm/core'
import {
  NOVEL_TEMPLATE_SEEDS,
  NOVEL_TEMPLATE_SEED_VERSION
} from '~~/shared/novel-catalog'
import { NovelTemplateSchema, SiteConfigSchema } from '../database/entities'

async function upsertTemplateSeedVersion(em: EntityManager) {
  const existing = await em.findOne(SiteConfigSchema, {
    key: 'novel_template_seed_version'
  })
  if (existing) {
    existing.value = NOVEL_TEMPLATE_SEED_VERSION
    return
  }

  em.create(SiteConfigSchema, {
    key: 'novel_template_seed_version',
    value: NOVEL_TEMPLATE_SEED_VERSION
  })
}

export async function createMissingNovelTemplateSeeds(em: EntityManager) {
  const existingTemplates = await em.find(NovelTemplateSchema, {})
  const existingNames = new Set(
    existingTemplates.map((template) => template.name)
  )
  let created = 0

  for (const template of NOVEL_TEMPLATE_SEEDS) {
    if (existingNames.has(template.name)) continue
    em.create(NovelTemplateSchema, template)
    existingNames.add(template.name)
    created += 1
  }

  await upsertTemplateSeedVersion(em)
  return created
}

export async function syncNovelTemplateSeeds(orm: MikroORM) {
  const em = orm.em.fork()
  const seedVersion = await em.findOne(SiteConfigSchema, {
    key: 'novel_template_seed_version'
  })
  if (seedVersion?.value === NOVEL_TEMPLATE_SEED_VERSION) {
    return { created: 0, version: NOVEL_TEMPLATE_SEED_VERSION, skipped: true }
  }

  const created = await createMissingNovelTemplateSeeds(em)
  await em.flush()

  return { created, version: NOVEL_TEMPLATE_SEED_VERSION, skipped: false }
}

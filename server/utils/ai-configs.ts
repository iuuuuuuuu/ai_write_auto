import type { EntityManager } from '@mikro-orm/core'
import { AiConfigSchema, NovelSchema, type AiConfig } from '../database/entities'

export type AiConfigPurpose =
  | 'generation'
  | 'extraction'
  | 'consistency_check'
  | 'style_analysis'

export async function resolveUserAiConfig(
  em: EntityManager,
  userId: number,
  purpose: AiConfigPurpose,
  aiConfigId?: number
): Promise<AiConfig> {
  const configs = await em.find(AiConfigSchema, {
    user: userId,
    purpose,
  })

  const enabledConfigs = configs.filter((c) => c.enabled !== false)
  const config =
    aiConfigId
      ? enabledConfigs.find((item) => item.id === aiConfigId)
      : enabledConfigs.find((item) => item.isDefault) || enabledConfigs[0]

  if (!config) {
    throw createError({
      statusCode: 400,
      message: `No AI config found for ${purpose}`,
    })
  }

  return config
}

export async function resolveNovelAiConfig(
  em: EntityManager,
  userId: number,
  novelId: number,
  purpose: AiConfigPurpose,
  requestAiConfigId?: number
): Promise<AiConfig> {
  // Priority: request-specified > novel-configured > user default
  if (requestAiConfigId) {
    return resolveUserAiConfig(em, userId, purpose, requestAiConfigId)
  }

  const novel = await em.findOne(NovelSchema, { id: novelId }, { populate: ['aiConfig'] })
  if (novel?.aiConfig && (novel.aiConfig as any).id) {
    const novelConfig = await em.findOne(AiConfigSchema, { id: (novel.aiConfig as any).id })
    if (novelConfig && novelConfig.enabled) {
      return novelConfig
    }
  }

  return resolveUserAiConfig(em, userId, purpose)
}

export function maskApiKey(apiKey: string) {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '********'
  return `${apiKey.slice(0, 4)}********${apiKey.slice(-4)}`
}

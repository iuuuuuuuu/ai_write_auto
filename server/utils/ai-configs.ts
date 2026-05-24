import type { EntityManager } from '@mikro-orm/core'
import { AiConfigSchema, AiModelSchema, NovelSchema, type AiConfig, type AiModel } from '../database/entities'

export type AiConfigPurpose =
  | 'generation'
  | 'extraction'
  | 'consistency_check'
  | 'style_analysis'

export interface ResolvedAiConfig {
  id: number
  configId: number
  modelId: number
  apiUrl: string
  apiKey: string
  model: string
  temperature: string | null
  maxTokens: number
}

function toResolved(config: AiConfig): ResolvedAiConfig {
  const aiModel = config.aiModel as AiModel
  if (!aiModel.enabled) {
    throw createError({
      statusCode: 400,
      message: `模型「${aiModel.name}」已被禁用，请在模型库中启用或更换模型`
    })
  }
  return {
    id: config.id,
    configId: config.id,
    modelId: aiModel.id,
    apiUrl: aiModel.apiUrl,
    apiKey: aiModel.apiKey,
    model: aiModel.model,
    temperature: config.temperature,
    maxTokens: aiModel.maxTokens
  }
}

export async function resolveUserAiConfig(
  em: EntityManager,
  userId: number,
  purpose: AiConfigPurpose,
  aiConfigId?: number
): Promise<ResolvedAiConfig> {
  const configs = await em.find(AiConfigSchema, {
    user: userId,
    purpose,
  }, { populate: ['aiModel'] })

  const enabledConfigs = configs.filter(c => c.enabled !== false)
  const config = aiConfigId
    ? enabledConfigs.find(item => item.id === aiConfigId)
    : enabledConfigs.find(item => item.isDefault) || enabledConfigs[0]

  if (!config) {
    throw createError({
      statusCode: 400,
      message: `未找到「${purpose}」用途的 AI 配置，请先在设置中添加`
    })
  }

  return toResolved(config)
}

export async function resolveNovelAiConfig(
  em: EntityManager,
  userId: number,
  novelId: number,
  purpose: AiConfigPurpose,
  requestAiConfigId?: number
): Promise<ResolvedAiConfig> {
  if (requestAiConfigId) {
    return resolveUserAiConfig(em, userId, purpose, requestAiConfigId)
  }

  const novel = await em.findOne(NovelSchema, { id: novelId }, { populate: ['aiConfig'] })
  if (novel?.aiConfig && (novel.aiConfig as any).id) {
    const novelConfig = await em.findOne(AiConfigSchema, {
      id: (novel.aiConfig as any).id
    }, { populate: ['aiModel'] })
    if (novelConfig && novelConfig.enabled) {
      return toResolved(novelConfig)
    }
  }

  return resolveUserAiConfig(em, userId, purpose)
}

export function maskApiKey(apiKey: string) {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '********'
  return `${apiKey.slice(0, 4)}********${apiKey.slice(-4)}`
}

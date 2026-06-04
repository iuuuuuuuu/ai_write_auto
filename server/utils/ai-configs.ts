/**
 * AI 配置解析策略：
 *
 * resolveUserAiConfig(em, userId, purpose, aiConfigId?)
 *   按用户级别解析配置，不考虑小说级别覆盖。
 *   用于：analyze-style (style_analysis)
 *
 * resolveNovelAiConfig(em, userId, novelId, purpose, aiConfigId?)
 *   优先使用小说级别配置覆盖，回退到用户级别。
 *   用于：generate, regenerate, continue, rewrite, expand,
 *         fragment, suggest, generate-outline (均为 generation 用途)
 *
 * 选择原则：
 * - 与特定小说内容相关的操作 → resolveNovelAiConfig（允许每本小说用不同模型）
 * - 全局分析类操作 → resolveUserAiConfig（不依赖小说级别配置）
 */
import type { EntityManager } from '@mikro-orm/core'
import { AiConfigSchema, NovelSchema, type AiConfig, type AiModel, type AiProvider } from '../database/entities'

export type AiConfigPurpose =
  | 'generation'
  | 'extraction'
  | 'consistency_check'
  | 'style_analysis'
  | 'planning'

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
  const provider = aiModel.provider as AiProvider
  if (!provider.enabled) {
    throw createError({
      statusCode: 400,
      message: `供应商「${provider.name}」已被禁用，请在模型库中启用或更换供应商`
    })
  }
  return {
    id: config.id,
    configId: config.id,
    modelId: aiModel.id,
    apiUrl: provider.apiUrl,
    apiKey: provider.apiKey,
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
  }, { populate: ['aiModel', 'aiModel.provider'] })

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
    }, { populate: ['aiModel', 'aiModel.provider'] })
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

/**
 * 解析「生成检索 query」这一步用的配置（决策③：走廉价模型，正文仍用 generation）。
 * 用 USER 级解析（不走小说级覆盖，避免把小说的 generation 高配模型误用作 query 生成）：
 * 依次尝试 planning → extraction → generation，全部缺失返回 null（调用方降级为 seed-only），
 * **绝不抛错**——缺 planning 配置不能中断生成。
 */
export async function resolvePlanningConfig(
  em: EntityManager,
  userId: number
): Promise<ResolvedAiConfig | null> {
  const purposes: AiConfigPurpose[] = ['planning', 'extraction', 'generation']
  for (const purpose of purposes) {
    try {
      return await resolveUserAiConfig(em, userId, purpose)
    } catch {
      /* 该用途无可用配置，尝试下一个 */
    }
  }
  return null
}

/**
 * 代理式按需检索总开关（决策⑤）。默认开；设 AGENTIC_RETRIEVAL=off|false|0 作 kill-switch。
 * 关闭时全部端点回落 seed-only（≈现状启发式检索）。
 */
export function isAgenticRetrievalEnabled(): boolean {
  const v = (process.env.AGENTIC_RETRIEVAL || '').trim().toLowerCase()
  return v !== 'off' && v !== 'false' && v !== '0'
}

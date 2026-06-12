import { callAi } from '../../utils/ai-client'
import { selectAiStatusConfig } from '../../utils/ai-configs'
import { getEmbeddingStatus } from '../../services/embedding'
import {
  AiConfigSchema,
  type AiConfig,
  type AiModel,
  type AiProvider
} from '../../database/entities'

function parseOptionalPositiveInt(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function getUnavailableReason(configs: readonly AiConfig[]): string {
  if (!configs.length) return '未配置内容生成模型'
  if (!configs.some((config) => config.enabled !== false)) {
    return '内容生成配置已禁用'
  }
  const hasEnabledModel = configs.some((config) => {
    const model = config.aiModel as AiModel | undefined
    const provider = model?.provider as AiProvider | null | undefined
    return (
      config.enabled !== false &&
      model?.enabled !== false &&
      !!provider &&
      provider.enabled !== false
    )
  })
  if (!hasEnabledModel) return '内容生成模型或供应商已禁用'
  return '没有最近检测可用的内容生成模型，请点击重试重新检测'
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const query = getQuery(event)
  const shouldCheckConnectivity = query.check === 'true' || query.check === '1'
  const requestedConfigId = parseOptionalPositiveInt(query.aiConfigId)

  const checkedAt = new Date().toISOString()

  const configs = await em.find(
    AiConfigSchema,
    { user: auth.userId, purpose: 'generation' },
    {
      populate: ['aiModel', 'aiModel.provider'],
      orderBy: { isDefault: 'DESC', order: 'ASC', createdAt: 'ASC' }
    }
  )
  const config = selectAiStatusConfig(configs, {
    requestedConfigId,
    allowUnchecked: shouldCheckConnectivity
  })

  if (!config) {
    return {
      available: false,
      checkedAt,
      checkedConnectivity: shouldCheckConnectivity,
      reason: getUnavailableReason(configs)
    }
  }

  const model = config.aiModel as AiModel
  const provider = model.provider as AiProvider

  if (shouldCheckConnectivity) {
    let available = false
    let reason: string | null = null
    try {
      await callAi({
        apiUrl: provider.apiUrl,
        apiKey: provider.apiKey,
        model: model.model,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        maxTokens: 8,
        tracking: {
          userId: auth.userId,
          configId: config.id,
          modelId: model.id,
          modelType: 'connectivity_check',
          purpose: 'planning',
          scenario: 'model_connectivity_check',
          source: 'api_route',
          endpoint: '/api/ai/status'
        }
      })
      available = true
    } catch {
      reason = 'AI 连通性检测失败，请检查 API 地址、密钥或网络'
    }

    model.lastCheckAt = new Date()
    model.lastCheckAvailable = available
    model.lastCheckReason = reason
    provider.lastCheckAt = model.lastCheckAt
    provider.lastCheckAvailable = available
    provider.lastCheckReason = reason
    await em.flush()

    if (!available) {
      return {
        available: false,
        checkedAt,
        checkedConnectivity: true,
        reason
      }
    }
  }

  return {
    available: true,
    checkedAt,
    checkedConnectivity: shouldCheckConnectivity,
    reason: null,
    rag: getEmbeddingStatus()
  }
})

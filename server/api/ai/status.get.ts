import { AiConfigSchema } from '../../database/entities'
import { callAi } from '../../utils/ai-client'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const query = getQuery(event)
  const shouldCheckConnectivity = query.check === 'true' || query.check === '1'

  const configs = await em.find(AiConfigSchema, {
    user: auth.userId,
    purpose: 'generation',
    enabled: true
  })

  const config = configs.find((item) => item.isDefault) || configs[0]
  const checkedAt = new Date().toISOString()

  if (!config) {
    return {
      available: false,
      checkedAt,
      checkedConnectivity: shouldCheckConnectivity,
      reason: '未配置可用的内容生成模型',
      generationConfigs: []
    }
  }

  if (shouldCheckConnectivity) {
    try {
      await callAi({
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        maxTokens: 8
      })
    } catch {
      return {
        available: false,
        checkedAt,
        checkedConnectivity: true,
        reason: 'AI 连通性检测失败，请检查 API 地址、密钥或网络',
        generationConfigs: configs.map((item) => ({
          id: item.id,
          name: item.name,
          model: item.model,
          isDefault: item.isDefault
        }))
      }
    }
  }

  return {
    available: true,
    checkedAt,
    checkedConnectivity: shouldCheckConnectivity,
    reason: null,
    generationConfigs: configs.map((item) => ({
      id: item.id,
      name: item.name,
      model: item.model,
      isDefault: item.isDefault
    }))
  }
})

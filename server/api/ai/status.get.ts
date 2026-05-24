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
  }, { populate: ['aiModel'] })

  const config = configs.find(item => item.isDefault) || configs[0]
  const checkedAt = new Date().toISOString()

  if (!config || !config.aiModel) {
    return {
      available: false,
      checkedAt,
      checkedConnectivity: shouldCheckConnectivity,
      reason: '未配置可用的内容生成模型'
    }
  }

  const aiModel = config.aiModel as any

  if (shouldCheckConnectivity) {
    try {
      await callAi({
        apiUrl: aiModel.apiUrl,
        apiKey: aiModel.apiKey,
        model: aiModel.model,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        maxTokens: 8
      })
    } catch {
      return {
        available: false,
        checkedAt,
        checkedConnectivity: true,
        reason: 'AI 连通性检测失败，请检查 API 地址、密钥或网络'
      }
    }
  }

  return {
    available: true,
    checkedAt,
    checkedConnectivity: shouldCheckConnectivity,
    reason: null
  }
})

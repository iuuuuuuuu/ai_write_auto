import { callAi } from '../../utils/ai-client'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { getEmbeddingStatus } from '../../services/embedding'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const query = getQuery(event)
  const shouldCheckConnectivity = query.check === 'true' || query.check === '1'

  const checkedAt = new Date().toISOString()

  let resolved
  try {
    resolved = await resolveUserAiConfig(em, auth.userId, 'generation')
  } catch {
    return {
      available: false,
      checkedAt,
      checkedConnectivity: shouldCheckConnectivity,
      reason: '未配置可用的内容生成模型'
    }
  }

  if (shouldCheckConnectivity) {
    try {
      await callAi({
        apiUrl: resolved.apiUrl,
        apiKey: resolved.apiKey,
        model: resolved.model,
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
    reason: null,
    rag: getEmbeddingStatus()
  }
})

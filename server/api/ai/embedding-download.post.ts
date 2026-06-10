import { ensureModel, getEmbeddingStatus } from '../../services/embedding'
import {
  failAiGenerationLog,
  finishAiGenerationLog,
  type AiGenerationLogHandle,
  startAiGenerationLog
} from '../../utils/ai-generation-logs'

async function runEmbeddingDownloadWithLog(userId: number): Promise<void> {
  let logHandle: AiGenerationLogHandle | null = null
  try {
    logHandle = await startAiGenerationLog({
      userId,
      model: 'Xenova/bge-small-zh-v1.5',
      modelType: 'embedding',
      purpose: 'embedding',
      scenario: 'embedding_model_download',
      source: 'api_route',
      endpoint: '/api/ai/embedding-download'
    })
    await ensureModel()
    await finishAiGenerationLog(logHandle)
  } catch (error: unknown) {
    if (logHandle) {
      await failAiGenerationLog(
        logHandle,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const current = getEmbeddingStatus()
  if (current.status === 'ready') {
    return { success: true, message: '模型已就绪' }
  }
  if (current.status === 'downloading') {
    return { success: true, message: '模型正在下载中' }
  }

  void runEmbeddingDownloadWithLog(auth.userId)
  return { success: true, message: '模型开始下载' }
})

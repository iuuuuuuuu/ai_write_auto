import { ensureModel, getEmbeddingStatus } from '../../services/embedding'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const current = getEmbeddingStatus()
  if (current.status === 'ready') {
    return { success: true, message: '模型已就绪' }
  }
  if (current.status === 'downloading') {
    return { success: true, message: '模型正在下载中' }
  }

  ensureModel().catch(() => {})
  return { success: true, message: '模型开始下载' }
})

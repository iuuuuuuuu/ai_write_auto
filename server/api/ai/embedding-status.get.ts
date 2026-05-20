import { getEmbeddingStatus } from '../../services/embedding'

export default defineEventHandler(() => {
  return getEmbeddingStatus()
})

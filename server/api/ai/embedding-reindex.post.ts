import { isEmbeddingReady } from '../../services/embedding'
import { reindexNovel } from '../../services/character-rag'
import { NovelSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const novelId = body?.novelId as number

  if (!novelId) {
    throw createError({ statusCode: 400, message: 'novelId is required' })
  }

  const em = useEm(event)
  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: '小说不存在或无权访问' })
  }

  if (!isEmbeddingReady()) {
    throw createError({ statusCode: 503, message: '嵌入模型未就绪，请先下载模型' })
  }

  const indexed = await reindexNovel(novelId)
  return { success: true, indexed }
})

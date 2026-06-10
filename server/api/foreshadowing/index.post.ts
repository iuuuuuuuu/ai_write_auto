import { z } from 'zod'
import {
  ForeshadowingSchema,
  NovelSchema,
  ChapterSchema
} from '../../database/entities'
import { isEmbeddingReady } from '../../services/embedding'
import { indexForeshadowing } from '../../services/content-rag'

const schema = z.object({
  novelId: z.number().int().positive(),
  content: z.string().min(1).max(1000),
  description: z.string().max(500).optional(),
  chapterId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = schema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  let chapter = null
  if (data.chapterId) {
    chapter = await em.findOne(ChapterSchema, {
      id: data.chapterId,
      novel: data.novelId,
      deletedAt: null
    })
    if (!chapter) {
      throw createError({ statusCode: 400, message: 'Chapter not found' })
    }
  }

  const foreshadowing = em.create(ForeshadowingSchema, {
    novel: data.novelId,
    chapter: chapter || null,
    content: data.content,
    description: data.description || null,
    status: 'active'
  })
  await em.flush()

  // Index for RAG
  if (isEmbeddingReady()) {
    await indexForeshadowing(
      foreshadowing.id,
      data.novelId,
      chapter?.id || null,
      data.content
    ).catch(() => {})
  }

  return {
    id: foreshadowing.id,
    content: foreshadowing.content,
    status: foreshadowing.status
  }
})

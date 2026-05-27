import { z } from 'zod'
import { NovelSchema, ChapterSchema } from '../../../../database/entities'

const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  chapterNumber: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const body = await readBody(event)
  const data = createChapterSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId, deletedAt: null })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  let chapterNumber = data.chapterNumber
  if (!chapterNumber) {
    const existing = await em.find(ChapterSchema, { novel: novelId }, { orderBy: { chapterNumber: 'ASC' } })
    chapterNumber = existing.length + 1
  }

  const wordCount = data.content ? data.content.replace(/\s/g, '').length : 0

  const chapter = em.create(ChapterSchema, {
    novel: novelId,
    chapterNumber,
    title: data.title,
    content: data.content || null,
    status: 'draft',
    wordCount,
  })
  await em.flush()

  return chapter
})

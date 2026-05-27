import { z } from 'zod'
import { NovelSchema, ChapterSchema, NovelOutlineSchema } from '../../../../database/entities'

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const body = await readBody(event)
  const { orderedIds } = reorderSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  // Build old→new chapter number mapping
  const chapters = await em.find(ChapterSchema, { novel: novelId, deletedAt: null })
  const oldNumberMap = new Map(chapters.map(ch => [ch.id, ch.chapterNumber]))

  for (let i = 0; i < orderedIds.length; i++) {
    const chapterId = orderedIds[i]!
    await em.nativeUpdate(ChapterSchema, { id: chapterId, novel: novelId }, { chapterNumber: i + 1, updatedAt: new Date() })
  }

  // Update novel outlines to match new chapter numbers
  const outlines = await em.find(NovelOutlineSchema, { novel: novelId })
  if (outlines.length > 0) {
    const numberRemap = new Map<number, number>()
    for (let i = 0; i < orderedIds.length; i++) {
      const chapterId = orderedIds[i]!
      const oldNum = oldNumberMap.get(chapterId)
      if (oldNum !== undefined) {
        numberRemap.set(oldNum, i + 1)
      }
    }
    for (const outline of outlines) {
      const newNum = numberRemap.get(outline.chapterNumber)
      if (newNum !== undefined && newNum !== outline.chapterNumber) {
        outline.chapterNumber = newNum
        outline.sortOrder = newNum - 1
      }
    }
    await em.flush()
  }

  return { success: true }
})

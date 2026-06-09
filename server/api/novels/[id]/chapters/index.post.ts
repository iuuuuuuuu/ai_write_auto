import { z } from 'zod'
import { NovelSchema, ChapterSchema, NovelOutlineSchema } from '../../../../database/entities'

const createChapterSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  chapterNumber: z.number().int().positive().optional(),
  // 指定插入位置：相对某个参考章节之前/之后。缺省或 'end' 时追加到末尾。
  position: z.enum(['end', 'before', 'after']).optional(),
  refChapterId: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const body = await readBody(event)
  const data = createChapterSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId, deletedAt: null })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const wordCount = data.content ? data.content.replace(/\s/g, '').length : 0

  // 现有章节按章号升序（仅未删除），用于计算插入位置；列表顺序与前端展示一致。
  const existing = await em.find(
    ChapterSchema,
    { novel: novelId, deletedAt: null },
    { orderBy: { chapterNumber: 'ASC' } }
  )

  // 计算插入索引：默认追加到末尾。
  let insertIndex = existing.length
  if ((data.position === 'before' || data.position === 'after') && data.refChapterId) {
    const refIdx = existing.findIndex((c) => c.id === data.refChapterId)
    if (refIdx >= 0) {
      insertIndex = data.position === 'before' ? refIdx : refIdx + 1
    }
  }

  // 快速路径：追加到末尾，无需重排其它章节。
  if (insertIndex >= existing.length) {
    const chapter = em.create(ChapterSchema, {
      novel: novelId,
      chapterNumber: data.chapterNumber ?? existing.length + 1,
      title: data.title?.trim() || '',
      content: data.content || null,
      status: 'draft',
      wordCount,
    })
    await em.flush()
    return chapter
  }

  // 中间插入：先建新章节（章号临时），随后按最终顺序把所有章节重排为 1..N+1，
  // 并同步把大纲的章号一起平移，避免「第N章大纲」与章节错位。
  const chapter = em.create(ChapterSchema, {
    novel: novelId,
    chapterNumber: existing.length + 1,
    title: data.title?.trim() || '',
    content: data.content || null,
    status: 'draft',
    wordCount,
  })
  await em.flush()

  const orderedIds = existing.map((c) => c.id)
  orderedIds.splice(insertIndex, 0, chapter.id)

  const oldNumberMap = new Map(existing.map((ch) => [ch.id, ch.chapterNumber]))
  for (let i = 0; i < orderedIds.length; i++) {
    await em.nativeUpdate(
      ChapterSchema,
      { id: orderedIds[i]!, novel: novelId },
      { chapterNumber: i + 1, updatedAt: new Date() }
    )
  }

  const outlines = await em.find(NovelOutlineSchema, { novel: novelId })
  if (outlines.length > 0) {
    const numberRemap = new Map<number, number>()
    for (let i = 0; i < orderedIds.length; i++) {
      const oldNum = oldNumberMap.get(orderedIds[i]!)
      if (oldNum !== undefined) numberRemap.set(oldNum, i + 1)
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

  chapter.chapterNumber = insertIndex + 1
  return chapter
})

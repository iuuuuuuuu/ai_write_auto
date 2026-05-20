import { NovelSchema, ChapterSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const pagination = parsePagination(event)

    const novelFilter = { user: auth.userId, deletedAt: { $ne: null } }
    const chapterFilter = { novel: { user: auth.userId }, deletedAt: { $ne: null } }

    const [novels, novelsTotal, chapters, chaptersTotal] = await Promise.all([
      em.find(NovelSchema, novelFilter, {
        limit: pagination.limit,
        offset: pagination.offset,
        orderBy: { deletedAt: 'DESC' },
      }),
      em.count(NovelSchema, novelFilter),
      em.find(ChapterSchema, chapterFilter, {
        limit: pagination.limit,
        offset: pagination.offset,
        populate: ['novel'],
        orderBy: { deletedAt: 'DESC' },
      }),
      em.count(ChapterSchema, chapterFilter),
    ])

    return {
      novels: paginatedResult(novels, novelsTotal, pagination),
      chapters: paginatedResult(chapters, chaptersTotal, pagination),
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { type, id } = body

    if (type === 'novel') {
      const novel = await em.findOne(NovelSchema, {
        id,
        user: auth.userId,
      })

      if (!novel) {
        throw createError({ statusCode: 404, message: 'Not found' })
      }

      novel.deletedAt = null
      await em.nativeUpdate(ChapterSchema, { novel: id }, { deletedAt: null })
      await em.flush()
      return { success: true }
    }

    if (type === 'chapter') {
      const chapter = await em.findOne(ChapterSchema, {
        id,
        novel: { user: auth.userId },
      })

      if (!chapter) {
        throw createError({ statusCode: 404, message: 'Not found' })
      }

      chapter.deletedAt = null
      await em.flush()
      return { success: true }
    }

    throw createError({ statusCode: 400, message: 'Invalid type' })
  }
})

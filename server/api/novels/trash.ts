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

  if (method === 'DELETE') {
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

      // 永久删除该小说的所有章节版本、笔记、角色关联等
      await em.nativeDelete('ChapterVersion', { chapter: { novel: id } })
      await em.nativeDelete('ChapterNote', { chapter: { novel: id } })
      await em.nativeDelete('ChapterCharacter', { chapter: { novel: id } })
      await em.nativeDelete('CharacterAppearance', { novel: id })
      await em.nativeDelete('PlotPoint', { novel: id })
      await em.nativeDelete('StoryArc', { novel: id })
      await em.nativeDelete('NovelOutline', { novel: id })
      await em.nativeDelete('Chapter', { novel: id })
      await em.nativeDelete('Character', { novel: id })
      await em.nativeDelete('GenerationTask', { novel: id })
      await em.removeAndFlush(novel)
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

      await em.nativeDelete('ChapterVersion', { chapter: id })
      await em.nativeDelete('ChapterNote', { chapter: id })
      await em.nativeDelete('ChapterCharacter', { chapter: id })
      await em.nativeDelete('CharacterAppearance', { chapter: id })
      await em.removeAndFlush(chapter)
      return { success: true }
    }

    throw createError({ statusCode: 400, message: 'Invalid type' })
  }
})

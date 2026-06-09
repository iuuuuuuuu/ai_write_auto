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

      // 永久删除：先清掉所有引用 chapter/novel 的子表，再删 chapter、character，最后删 novel。
      // ConsistencyIssue / Foreshadowing / GenerationTask 都有 chapter_id 外键，必须在删 chapters 之前清除，
      // 否则触发 FOREIGN KEY constraint failed。
      await em.nativeDelete('ConsistencyIssue', { chapter: { novel: id } })
      await em.nativeDelete('ChapterVersion', { chapter: { novel: id } })
      await em.nativeDelete('ChapterNote', { chapter: { novel: id } })
      await em.nativeDelete('ChapterCharacter', { chapter: { novel: id } })
      await em.nativeDelete('CharacterAppearance', { novel: id })
      await em.nativeDelete('Foreshadowing', { novel: id })
      await em.nativeDelete('PlotPoint', { novel: id })
      await em.nativeDelete('StoryArc', { novel: id })
      await em.nativeDelete('NovelOutline', { novel: id })
      await em.nativeDelete('GenerationTask', { novel: id })
      await em.nativeDelete('Chapter', { novel: id })
      await em.nativeDelete('Character', { novel: id })
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

      // 本章独有的子记录直接删；小说级但引用本章的（伏笔/剧情线索/生成任务，chapter_id 可空）改为置空，
      // 避免删单章时连带丢失小说级数据，同时绕开外键约束。
      await em.nativeDelete('ConsistencyIssue', { chapter: id })
      await em.nativeDelete('ChapterVersion', { chapter: id })
      await em.nativeDelete('ChapterNote', { chapter: id })
      await em.nativeDelete('ChapterCharacter', { chapter: id })
      await em.nativeDelete('CharacterAppearance', { chapter: id })
      await em.nativeUpdate('Foreshadowing', { chapter: id }, { chapter: null })
      await em.nativeUpdate('PlotPoint', { chapter: id }, { chapter: null })
      await em.nativeUpdate('GenerationTask', { chapter: id }, { chapter: null })
      await em.removeAndFlush(chapter)
      return { success: true }
    }

    throw createError({ statusCode: 400, message: 'Invalid type' })
  }
})

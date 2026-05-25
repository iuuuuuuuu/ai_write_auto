import { z } from 'zod'
import { ChapterSchema, NovelSchema } from '../../database/entities'

const schema = z.object({
  type: z.enum(['chapter', 'novel']),
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const query = getQuery(event)
  const { type, id } = schema.parse(query)

  if (type === 'chapter') {
    const chapter = await em.findOne(ChapterSchema, {
      id,
      novel: { user: auth.userId },
      deletedAt: { $ne: null }
    }, { populate: ['content', 'novel'] })

    if (!chapter) throw createError({ statusCode: 404, message: '章节不存在' })

    return {
      id: chapter.id,
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      content: chapter.content || '',
      wordCount: chapter.wordCount,
      novelTitle: (chapter.novel as any)?.title || '',
      deletedAt: chapter.deletedAt
    }
  }

  if (type === 'novel') {
    const novel = await em.findOne(NovelSchema, {
      id,
      user: auth.userId,
      deletedAt: { $ne: null }
    })

    if (!novel) throw createError({ statusCode: 404, message: '小说不存在' })

    const chapters = await em.find(ChapterSchema, { novel: id }, { orderBy: { chapterNumber: 'ASC' } })

    return {
      id: novel.id,
      title: novel.title,
      description: novel.description,
      genre: novel.genre,
      status: novel.status,
      deletedAt: novel.deletedAt,
      chapters: chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        chapterNumber: ch.chapterNumber,
        wordCount: ch.wordCount
      }))
    }
  }
})

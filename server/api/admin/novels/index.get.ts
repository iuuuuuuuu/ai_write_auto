import { NovelSchema, UserSchema, ChapterSchema } from '../../../database/entities'
import { wrap } from '@mikro-orm/core'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)

  const search = (query.search as string || '').trim().toLowerCase()
  const status = query.status as string || ''

  const filter: Record<string, any> = {}
  if (status && status !== 'all') {
    filter.status = status
  }
  if (search) {
    filter.title = { $like: `%${search}%` }
  }

  const [novels, total] = await Promise.all([
    em.find(NovelSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { updatedAt: 'DESC' },
      populate: ['user'],
    }),
    em.count(NovelSchema, filter),
  ])

  const novelIds = novels.map((n) => n.id)

  const chapters = novelIds.length
    ? await em.find(ChapterSchema, { novel: { $in: novelIds }, deletedAt: null })
    : []

  const items = novels.map((novel) => {
    const novelChapters = chapters.filter((c: any) => {
      const cNovelId = typeof c.novel === 'object' ? c.novel?.id : c.novel
      return cNovelId === novel.id
    })
    const wordCount = novelChapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0)

    return {
      id: novel.id,
      title: novel.title,
      description: novel.description,
      genre: novel.genre,
      status: novel.status,
      deletedAt: novel.deletedAt,
      updatedAt: novel.updatedAt,
      user: novel.user ? { id: novel.user.id, username: novel.user.username, role: novel.user.role } : null,
      chapterCount: novelChapters.length,
      wordCount,
    }
  })

  return paginatedResult(items, total, pagination)
})

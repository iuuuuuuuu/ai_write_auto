import { NovelSchema, UserSchema, ChapterSchema } from '../../../database/entities'

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
    }),
    em.count(NovelSchema, filter),
  ])

  const userIds = [...new Set(novels.map((n) => n.user as any))]
  const novelIds = novels.map((n) => n.id)

  const [users, chapters] = await Promise.all([
    userIds.length ? em.find(UserSchema, { id: { $in: userIds } }) : [],
    novelIds.length ? em.find(ChapterSchema, { novel: { $in: novelIds }, deletedAt: null }) : [],
  ])

  const usersById = new Map(users.map((u) => [u.id, { id: u.id, username: u.username, role: u.role }]))

  const items = novels.map((novel) => {
    const novelChapters = chapters.filter((c: any) => c.novel === novel.id)
    const wordCount = novelChapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0)

    return {
      ...novel,
      user: usersById.get(novel.user as any) || null,
      chapterCount: novelChapters.length,
      wordCount,
    }
  })

  return paginatedResult(items, total, pagination)
})

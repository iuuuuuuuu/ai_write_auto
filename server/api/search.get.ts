import { ChapterSchema, NovelSchema, CharacterSchema } from '../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const keyword = (query.q as string || '').trim()
  const novelId = query.novelId ? parseInt(query.novelId as string) : undefined

  if (!keyword || keyword.length < 2) {
    throw createError({ statusCode: 400, message: 'Search query must be at least 2 characters' })
  }

  const em = useEm(event)
  const searchPattern = `%${keyword}%`

  // Search chapters
  const chapterFilter: any = {
    novel: { user: auth.userId, deletedAt: null },
    deletedAt: null,
    content: { $like: searchPattern },
  }
  if (novelId) {
    chapterFilter.novel.id = novelId
  }

  const chapterResults = await em.find(ChapterSchema, chapterFilter, {
    populate: ['novel'],
    limit: 50,
  })

  const highlights = chapterResults.map((r: any) => {
    const idx = r.content?.toLowerCase().indexOf(keyword.toLowerCase()) ?? -1
    const start = Math.max(0, idx - 50)
    const end = Math.min((r.content?.length || 0), idx + keyword.length + 50)
    const snippet = idx >= 0 ? '...' + r.content.slice(start, end) + '...' : ''

    return {
      id: r.id,
      title: r.title,
      chapterNumber: r.chapterNumber,
      novelId: r.novel?.id || r.novel,
      snippet,
    }
  })

  // Search novels
  const novelResults = await em.find(NovelSchema, {
    user: auth.userId,
    deletedAt: null,
    title: { $like: searchPattern },
  }, { limit: 10 })

  // Search characters
  const characterFilter: any = {
    novel: { user: auth.userId },
    name: { $like: searchPattern },
  }
  if (novelId) {
    characterFilter.novel.id = novelId
  }

  const characterResults = await em.find(CharacterSchema, characterFilter, { limit: 20 })

  return {
    chapters: highlights,
    novels: novelResults.map((n) => ({ id: n.id, title: n.title, description: n.description })),
    characters: characterResults.map((c: any) => ({ id: c.id, name: c.name, description: c.description, novelId: c.novel?.id || c.novel })),
  }
})

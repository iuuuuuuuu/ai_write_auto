import { ChapterSchema, NovelSchema, CharacterSchema } from '../database/entities'
import { searchFts } from '../database/fts'
import { getOrm } from '../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const keyword = (query.q as string || '').trim()
  const novelId = query.novelId ? parseInt(query.novelId as string) : undefined

  if (!keyword || keyword.length < 2) {
    throw createError({ statusCode: 400, message: 'Search query must be at least 2 characters' })
  }

  const em = useEm(event)
  const orm = getOrm()

  // FTS search for chapters
  const chapters = await searchFts(orm, keyword, {
    userId: auth.userId,
    novelId,
    limit: 50,
  })

  // Search novels by title (simple LIKE — small table, no FTS needed)
  const searchPattern = `%${keyword}%`
  const novelResults = await em.find(NovelSchema, {
    user: auth.userId,
    deletedAt: null,
    title: { $like: searchPattern },
  }, { limit: 10 })

  // Search characters by name (simple LIKE — small table)
  const characterFilter: any = {
    novel: { user: auth.userId },
    name: { $like: searchPattern },
  }
  if (novelId) {
    characterFilter.novel.id = novelId
  }

  const characterResults = await em.find(CharacterSchema, characterFilter, { limit: 20 })

  return {
    chapters,
    novels: novelResults.map((n) => ({ id: n.id, title: n.title, description: n.description })),
    characters: characterResults.map((c: any) => ({ id: c.id, name: c.name, description: c.description, novelId: c.novel?.id || c.novel })),
  }
})

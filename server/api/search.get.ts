import { eq, and, like, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const keyword = (query.q as string || '').trim()
  const novelId = query.novelId ? parseInt(query.novelId as string) : undefined

  if (!keyword || keyword.length < 2) {
    throw createError({ statusCode: 400, message: 'Search query must be at least 2 characters' })
  }

  const db = await getDatabase()
  const searchPattern = `%${keyword}%`

  let chaptersQuery = (db as any)
    .select({
      id: schema.chapters.id,
      title: schema.chapters.title,
      chapterNumber: schema.chapters.chapterNumber,
      novelId: schema.chapters.novelId,
      content: schema.chapters.content,
    })
    .from(schema.chapters)
    .innerJoin(schema.novels, eq(schema.chapters.novelId, schema.novels.id))
    .where(
      and(
        eq(schema.novels.userId, auth.userId),
        isNull(schema.chapters.deletedAt),
        isNull(schema.novels.deletedAt),
        like(schema.chapters.content, searchPattern),
        ...(novelId ? [eq(schema.chapters.novelId, novelId)] : [])
      )
    )
    .limit(50)

  const results = await chaptersQuery

  const highlights = results.map((r: any) => {
    const idx = r.content?.toLowerCase().indexOf(keyword.toLowerCase()) ?? -1
    const start = Math.max(0, idx - 50)
    const end = Math.min((r.content?.length || 0), idx + keyword.length + 50)
    const snippet = idx >= 0 ? '...' + r.content.slice(start, end) + '...' : ''

    return {
      id: r.id,
      title: r.title,
      chapterNumber: r.chapterNumber,
      novelId: r.novelId,
      snippet,
    }
  })

  const novelResults = await (db as any)
    .select({
      id: schema.novels.id,
      title: schema.novels.title,
      description: schema.novels.description,
    })
    .from(schema.novels)
    .where(
      and(
        eq(schema.novels.userId, auth.userId),
        isNull(schema.novels.deletedAt),
        like(schema.novels.title, searchPattern)
      )
    )
    .limit(10)

  const characterResults = await (db as any)
    .select({
      id: schema.characters.id,
      name: schema.characters.name,
      description: schema.characters.description,
      novelId: schema.characters.novelId,
    })
    .from(schema.characters)
    .innerJoin(schema.novels, eq(schema.characters.novelId, schema.novels.id))
    .where(
      and(
        eq(schema.novels.userId, auth.userId),
        like(schema.characters.name, searchPattern),
        ...(novelId ? [eq(schema.characters.novelId, novelId)] : [])
      )
    )
    .limit(20)

  return {
    chapters: highlights,
    novels: novelResults,
    characters: characterResults,
  }
})

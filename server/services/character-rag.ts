import { embedSingle, isEmbeddingReady } from './embedding'
import { upsertVector, searchVectors } from './vector-store'
import { getOrm } from '../database'
import { CharacterSchema, ChapterCharacterSchema } from '../database/entities'

export interface CharacterContext {
  characterId: number
  characterName: string
  content: string
  contentType: string
  chapterId: number | null
  score: number
}

export async function indexCharacterEvent(
  characterId: number,
  chapterId: number | null,
  novelId: number,
  content: string,
  contentType: 'chapter_story' | 'overall_arc' | 'profile'
): Promise<void> {
  if (!isEmbeddingReady()) return
  if (!content.trim()) return

  const embedding = await embedSingle(content)
  await upsertVector({
    characterId,
    chapterId,
    novelId,
    contentType,
    content,
    embedding
  })
}

export async function retrieveRelevant(
  novelId: number,
  query: string,
  topK: number = 10
): Promise<CharacterContext[]> {
  if (!isEmbeddingReady()) return []
  if (!query.trim()) return []

  const queryEmbedding = await embedSingle(query)
  const results = await searchVectors(queryEmbedding, novelId, topK)

  const orm = getOrm()
  const em = orm.em.fork()

  const characterIds = [...new Set(results.map(r => r.characterId))]
  const characters = await em.find(CharacterSchema, { id: { $in: characterIds } })
  const charMap = new Map(characters.map(c => [c.id, c]))

  return results.map(r => ({
    characterId: r.characterId,
    characterName: charMap.get(r.characterId)?.name || `Character#${r.characterId}`,
    content: r.content,
    contentType: r.contentType,
    chapterId: r.chapterId,
    score: r.score
  }))
}

export async function reindexNovel(novelId: number): Promise<number> {
  if (!isEmbeddingReady()) return 0

  const orm = getOrm()
  const em = orm.em.fork()
  let indexed = 0

  const characters = await em.find(CharacterSchema, { novel: novelId })
  for (const char of characters) {
    if (char.overallArc) {
      await indexCharacterEvent(char.id, null, novelId, char.overallArc, 'overall_arc')
      indexed++
    }
    const profile = [char.description, char.traits, char.relationships].filter(Boolean).join(' ')
    if (profile) {
      await indexCharacterEvent(char.id, null, novelId, `${char.name}：${profile}`, 'profile')
      indexed++
    }
  }

  const assignments = await em.find(ChapterCharacterSchema, {
    chapter: { novel: novelId }
  }, { populate: ['chapter', 'character'] }) as any[]

  for (const cc of assignments) {
    if (cc.chapterStory) {
      const charId = typeof cc.character === 'object' ? cc.character.id : cc.character
      const chapterId = typeof cc.chapter === 'object' ? cc.chapter.id : cc.chapter
      await indexCharacterEvent(charId, chapterId, novelId, cc.chapterStory, 'chapter_story')
      indexed++
    }
  }

  return indexed
}

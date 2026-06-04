import { embedSingle, isEmbeddingReady } from './embedding'
import { upsertVector, searchVectors } from './vector-store'
import { getOrm } from '../database'
import {
  CharacterSchema, ChapterCharacterSchema, PlotPointSchema,
  ChapterSchema, NovelSchema, ForeshadowingSchema
} from '../database/entities'

export interface ContentContext {
  characterId?: number
  characterName?: string
  content: string
  contentType: string
  chapterId: number | null
  score: number
}

export async function indexCharacterEvent(
  characterId: number, chapterId: number | null, novelId: number,
  content: string, contentType: 'chapter_story' | 'overall_arc' | 'profile'
): Promise<void> {
  if (!isEmbeddingReady() || !content.trim()) return
  const embedding = await embedSingle(content)
  await upsertVector({ characterId, chapterId, novelId, contentType, content, embedding })
}

export async function indexPlotEvent(plotId: number, novelId: number, chapterId: number | null, description: string): Promise<void> {
  if (!isEmbeddingReady() || !description.trim()) return
  const embedding = await embedSingle(description)
  await upsertVector({ characterId: plotId, chapterId, novelId, contentType: 'plot_event', content: description, embedding })
}

export async function indexWorldDetail(novelId: number, content: string): Promise<void> {
  if (!isEmbeddingReady() || !content.trim()) return
  const embedding = await embedSingle(content)
  await upsertVector({ characterId: 0, chapterId: null, novelId, contentType: 'world_detail', content, embedding })
}

export async function indexForeshadowing(foreshadowingId: number, novelId: number, chapterId: number | null, content: string): Promise<void> {
  if (!isEmbeddingReady() || !content.trim()) return
  const embedding = await embedSingle(content)
  await upsertVector({ characterId: foreshadowingId, chapterId, novelId, contentType: 'foreshadowing', content, embedding })
}

export async function indexChapterSummary(novelId: number, chapterId: number, summary: string): Promise<void> {
  if (!isEmbeddingReady() || !summary.trim()) return
  const embedding = await embedSingle(summary)
  await upsertVector({ characterId: 0, chapterId, novelId, contentType: 'chapter_summary', content: summary, embedding })
}

export async function retrieveRelevant(novelId: number, query: string, topK: number = 15, contentType?: string | string[]): Promise<ContentContext[]> {
  if (!isEmbeddingReady() || !query.trim()) return []
  const queryEmbedding = await embedSingle(query)
  const results = await searchVectors(queryEmbedding, novelId, topK, contentType)
  const orm = getOrm()
  const em = orm.em.fork()
  const characterIds = [...new Set(results.filter(r => !['plot_event','world_detail','chapter_summary','foreshadowing'].includes(r.contentType)).map(r => r.characterId))]
  const characters = characterIds.length > 0 ? await em.find(CharacterSchema, { id: { $in: characterIds } }) : []
  const charMap = new Map(characters.map(c => [c.id, c]))
  return results.map(r => ({
    characterId: r.characterId,
    characterName: charMap.get(r.characterId)?.name || undefined,
    content: r.content, contentType: r.contentType, chapterId: r.chapterId, score: r.score
  }))
}

export async function retrieveCharacterContext(novelId: number, query: string, topK: number = 10) {
  const results = await retrieveRelevant(novelId, query, topK)
  return results.filter(r => r.characterName).map(r => ({
    characterName: r.characterName!, content: r.content, contentType: r.contentType, chapterId: r.chapterId
  }))
}

export async function getActiveForeshadowing(novelId: number): Promise<Array<{ content: string; description: string | null; chapterNumber: number | null }>> {
  const orm = getOrm()
  const em = orm.em.fork()
  const active = await em.find(ForeshadowingSchema, { novel: novelId, status: 'active' }, { populate: ['chapter'] })
  return active.map(f => ({
    content: f.content, description: f.description,
    chapterNumber: f.chapter ? (f.chapter as any).chapterNumber : null
  }))
}

export async function reindexNovel(novelId: number): Promise<number> {
  if (!isEmbeddingReady()) return 0
  const orm = getOrm()
  const em = orm.em.fork()
  let indexed = 0
  const characters = await em.find(CharacterSchema, { novel: novelId })
  for (const char of characters) {
    if (char.overallArc) { await indexCharacterEvent(char.id, null, novelId, char.overallArc, 'overall_arc'); indexed++ }
    const profile = [char.description, char.traits, char.relationships].filter(Boolean).join(' ')
    if (profile) { await indexCharacterEvent(char.id, null, novelId, `${char.name}: ${profile}`, 'profile'); indexed++ }
  }
  const assignments = await em.find(ChapterCharacterSchema, { chapter: { novel: novelId } }, { populate: ['chapter', 'character'] })
  for (const cc of assignments as any[]) {
    if (cc.chapterStory) {
      const charId = typeof cc.character === 'object' ? cc.character.id : cc.character
      const chapterId = typeof cc.chapter === 'object' ? cc.chapter.id : cc.chapter
      await indexCharacterEvent(charId, chapterId, novelId, cc.chapterStory, 'chapter_story'); indexed++
    }
  }
  const plotPoints = await em.find(PlotPointSchema, { novel: novelId })
  for (const pp of plotPoints) {
    if (pp.description) {
      const chapterId = pp.chapter ? (typeof pp.chapter === 'object' ? pp.chapter.id : pp.chapter) : null
      await indexPlotEvent(pp.id, novelId, chapterId, pp.description); indexed++
    }
  }
  const novel = await em.findOne(NovelSchema, { id: novelId })
  if (novel?.worldSetting) { await indexWorldDetail(novelId, novel.worldSetting); indexed++ }
  const foreshadowings = await em.find(ForeshadowingSchema, { novel: novelId })
  for (const f of foreshadowings) {
    const chapterId = f.chapter ? (typeof f.chapter === 'object' ? f.chapter.id : f.chapter) : null
    await indexForeshadowing(f.id, novelId, chapterId, f.content); indexed++
  }
  const chapters = await em.find(ChapterSchema, { novel: novelId, deletedAt: null })
  for (const ch of chapters) {
    if (ch.summary) { await indexChapterSummary(novelId, ch.id, ch.summary); indexed++ }
  }
  return indexed
}

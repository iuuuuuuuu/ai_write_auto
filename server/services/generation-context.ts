import type { EntityManager } from '@mikro-orm/core'
import type { ResolvedAiConfig } from '../utils/ai-configs'
import { getActiveForeshadowing } from './content-rag'
import { ensureChapterOutline } from './outline-autofill'
import { resolveSkillIdsForNovel } from '../utils/writing-skills'
import {
  ChapterSchema,
  CharacterSchema,
  PlotPointSchema,
  StoryArcSchema,
  NovelOutlineSchema,
  type Chapter,
  type Character,
  type Novel,
  type PlotPoint,
  type StoryArc
} from '../database/entities'
import type { PromptForeshadowing } from '../utils/ai-prompts'

export interface ResolveChapterGenerationInputsOptions {
  em: EntityManager
  novel: Novel
  novelId: number
  userId: number
  chapterId?: number
  chapterOutline?: string
  direction?: string
  aiConfig: ResolvedAiConfig
  requestSkillIds?: number[]
}

export interface ChapterGenerationInputs {
  chapters: Chapter[]
  currentChapter: Chapter | undefined
  precedingChapters: Chapter[]
  characters: Character[]
  plotPoints: PlotPoint[]
  storyArcs: StoryArc[]
  chapterOutline: string | undefined
  foreshadowing: PromptForeshadowing[] | undefined
  recentChapterContent: Array<{
    chapterNumber: number
    title: string
    content: string
  }>
  skillIds: number[]
}

export async function resolveChapterGenerationInputs(
  opts: ResolveChapterGenerationInputsOptions
): Promise<ChapterGenerationInputs> {
  const chapters = await opts.em.find(
    ChapterSchema,
    { novel: opts.novelId, deletedAt: null },
    { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] }
  )
  const currentChapter =
    opts.chapterId ?
      chapters.find((chapter) => chapter.id === opts.chapterId)
    : undefined
  const precedingChapters =
    currentChapter ?
      chapters.filter(
        (chapter) => chapter.chapterNumber < currentChapter.chapterNumber
      )
    : chapters
  const characters = await opts.em.find(CharacterSchema, {
    novel: opts.novelId
  })
  const plotPoints = await opts.em.find(PlotPointSchema, {
    novel: opts.novelId
  })
  const storyArcs = await opts.em.find(StoryArcSchema, { novel: opts.novelId })

  let chapterOutline = opts.chapterOutline
  if (!chapterOutline && currentChapter) {
    const existingOutlines = await opts.em.find(
      NovelOutlineSchema,
      { novel: opts.novelId },
      { orderBy: { sortOrder: 'ASC' } }
    )
    const ensured = await ensureChapterOutline({
      em: opts.em,
      novel: opts.novel,
      novelId: opts.novelId,
      chapterNumber: currentChapter.chapterNumber,
      characters,
      existingOutlines: existingOutlines.map((outline) => ({
        chapterNumber: outline.chapterNumber,
        description: outline.description,
        sortOrder: outline.sortOrder
      })),
      direction: opts.direction,
      aiConfig: opts.aiConfig,
      userId: opts.userId
    })
    chapterOutline = ensured.description
  }

  let foreshadowing: PromptForeshadowing[] | undefined
  try {
    foreshadowing = await getActiveForeshadowing(opts.novelId)
  } catch {
    foreshadowing = undefined
  }

  const recentChapterContent: ChapterGenerationInputs['recentChapterContent'] =
    []
  for (const chapter of precedingChapters.slice(-2)) {
    if (chapter.content) {
      recentChapterContent.push({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        content: chapter.content.slice(-4000)
      })
    }
  }

  const skillIds = await resolveSkillIdsForNovel(opts.em, {
    requestSkillIds: opts.requestSkillIds,
    novelEnabledRaw: opts.novel.enabledSkillIds,
    genre: opts.novel.genre
  })

  return {
    chapters,
    currentChapter,
    precedingChapters,
    characters,
    plotPoints,
    storyArcs,
    chapterOutline,
    foreshadowing,
    recentChapterContent,
    skillIds
  }
}

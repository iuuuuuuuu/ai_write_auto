import { getOrm } from '../database'
import { callAi } from '../utils/ai-client'
import { runConsistencyCheck } from '../utils/consistency-check'
import {
  buildSummaryPrompt,
  buildCharacterExtractionPrompt,
  buildChapterStoryPrompt,
  buildOverallArcPrompt,
  buildStoryArcPrompt
} from '../utils/ai-prompts'
import { isEmbeddingReady } from './embedding'
import { indexCharacterEvent } from './character-rag'
import {
  GenerationTaskSchema,
  ChapterSchema,
  AiConfigSchema,
  CharacterSchema,
  ChapterCharacterSchema,
  CharacterAppearanceSchema,
  StoryArcSchema
} from '../database/entities'
import type { GenerationTask } from '../database/entities'

const MAX_RETRIES = 3
const POST_PROCESSING_TYPES = ['extract_summary', 'extract_characters', 'consistency_check']

type ExtractedCharacterRole = 'main' | 'supporting' | 'mentioned'

type ExtractedAppearance = {
  snippet: string | null
  positionStart: number | null
  positionEnd: number | null
  background: string | null
}

type ExtractedCharacter = {
  name: string
  description: string | null
  traits: string | null
  currentState: string | null
  role: ExtractedCharacterRole
  appearances: ExtractedAppearance[]
}

function getEntityId(entity: unknown): number {
  if (typeof entity === 'number') return entity
  if (entity && typeof entity === 'object' && 'id' in entity) {
    return Number((entity as { id: unknown }).id)
  }
  return Number(entity)
}

function normalizeRole(value: unknown): ExtractedCharacterRole {
  return value === 'main' || value === 'mentioned' ? value : 'supporting'
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseExtractedCharacters(result: string): ExtractedCharacter[] {
  const parsed: unknown = JSON.parse(result)
  if (!Array.isArray(parsed)) {
    throw new Error('Character extraction result must be a JSON array')
  }

  return parsed
    .map((item): ExtractedCharacter | null => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>
      const name = normalizeNullableString(source.name)
      if (!name) return null

      const rawAppearances =
        Array.isArray(source.appearances) ? source.appearances : []
      const appearances = rawAppearances
        .map((appearance): ExtractedAppearance | null => {
          if (!appearance || typeof appearance !== 'object') return null
          const appearanceSource = appearance as Record<string, unknown>
          return {
            snippet: normalizeNullableString(appearanceSource.snippet),
            positionStart: normalizeNullableNumber(
              appearanceSource.positionStart
            ),
            positionEnd: normalizeNullableNumber(appearanceSource.positionEnd),
            background: normalizeNullableString(appearanceSource.background)
          }
        })
        .filter((appearance): appearance is ExtractedAppearance =>
          Boolean(appearance)
        )

      return {
        name,
        description: normalizeNullableString(source.description),
        traits: normalizeNullableString(source.traits),
        currentState: normalizeNullableString(source.currentState),
        role: normalizeRole(source.role),
        appearances
      }
    })
    .filter((item): item is ExtractedCharacter => Boolean(item))
}

async function processTask(task: GenerationTask): Promise<void> {
  const em = getOrm().em.fork()

  await em.nativeUpdate(
    GenerationTaskSchema,
    { id: task.id },
    { status: 'running' }
  )

  try {
    let result = ''

    if (task.type === 'extract_summary' && task.chapter) {
      const chapter = await em.findOne(ChapterSchema, {
        id: getEntityId(task.chapter)
      })
      if (chapter?.content) {
        const aiConfig = await em.findOne(AiConfigSchema, {
          purpose: 'extraction'
        })
        if (aiConfig) {
          const messages = buildSummaryPrompt(chapter.content)
          result = await callAi({
            apiUrl: aiConfig.apiUrl,
            apiKey: aiConfig.apiKey,
            model: aiConfig.model,
            messages,
            temperature: 0.3,
            maxTokens: 500
          })
          await em.nativeUpdate(
            ChapterSchema,
            { id: chapter.id },
            { summary: result }
          )
        }
      }
    }

    if (task.type === 'extract_characters' && task.chapter) {
      const chapter = await em.findOne(ChapterSchema, {
        id: getEntityId(task.chapter)
      })
      if (chapter?.content) {
        const aiConfig = await em.findOne(AiConfigSchema, {
          purpose: 'extraction'
        })
        if (aiConfig) {
          const messages = buildCharacterExtractionPrompt(chapter.content)
          result = await callAi({
            apiUrl: aiConfig.apiUrl,
            apiKey: aiConfig.apiKey,
            model: aiConfig.model,
            messages,
            temperature: 0.2,
            maxTokens: 2000
          })

          const novelId = getEntityId(task.novel)
          const chars = parseExtractedCharacters(result)
          for (const char of chars) {
            const existing = await em.findOne(CharacterSchema, {
              novel: novelId,
              name: char.name
            })
            const character =
              existing ||
              em.create(CharacterSchema, {
                novel: novelId,
                name: char.name,
                description: char.description,
                traits: char.traits,
                currentState: char.currentState,
                firstAppearanceChapter: chapter.chapterNumber,
                lastAppearanceChapter: chapter.chapterNumber
              })

            if (existing) {
              existing.description = char.description || existing.description
              existing.traits = char.traits || existing.traits
              existing.currentState = char.currentState || existing.currentState
              existing.firstAppearanceChapter =
                existing.firstAppearanceChapter === null ?
                  chapter.chapterNumber
                : Math.min(
                    existing.firstAppearanceChapter,
                    chapter.chapterNumber
                  )
              existing.lastAppearanceChapter =
                existing.lastAppearanceChapter === null ?
                  chapter.chapterNumber
                : Math.max(
                    existing.lastAppearanceChapter,
                    chapter.chapterNumber
                  )
            }

            await em.flush()

            const assignment = await em.findOne(ChapterCharacterSchema, {
              chapter: chapter.id,
              character: character.id
            })
            if (assignment) {
              assignment.role = char.role
            } else {
              em.create(ChapterCharacterSchema, {
                chapter: chapter.id,
                character: character.id,
                role: char.role
              })
            }

            await em.nativeDelete(CharacterAppearanceSchema, {
              chapter: chapter.id,
              character: character.id
            })

            for (const appearance of char.appearances.slice(0, 5)) {
              em.create(CharacterAppearanceSchema, {
                novel: novelId,
                chapter: chapter.id,
                character: character.id,
                role: char.role,
                snippet: appearance.snippet,
                positionStart: appearance.positionStart,
                positionEnd: appearance.positionEnd,
                background: appearance.background
              })
            }
          }
          await em.flush()

          // Generate chapter stories and update overall arcs
          const chapterChars = await em.find(ChapterCharacterSchema, {
            chapter: chapter.id
          })
          for (const cc of chapterChars) {
            const charEntity = await em.findOne(CharacterSchema, {
              id: getEntityId(cc.character)
            })
            if (!charEntity) continue

            const appearances = await em.find(CharacterAppearanceSchema, {
              chapter: chapter.id,
              character: charEntity.id
            })

            try {
              const storyMessages = buildChapterStoryPrompt(
                charEntity.name,
                chapter.content,
                appearances.map(a => ({ snippet: a.snippet, background: a.background }))
              )
              const chapterStory = await callAi({
                apiUrl: aiConfig.apiUrl,
                apiKey: aiConfig.apiKey,
                model: aiConfig.model,
                messages: storyMessages,
                temperature: 0.3,
                maxTokens: 500
              })
              cc.chapterStory = chapterStory

              const arcMessages = buildOverallArcPrompt(
                charEntity.name,
                charEntity.description,
                charEntity.overallArc,
                chapterStory,
                chapter.chapterNumber
              )
              const updatedArc = await callAi({
                apiUrl: aiConfig.apiUrl,
                apiKey: aiConfig.apiKey,
                model: aiConfig.model,
                messages: arcMessages,
                temperature: 0.3,
                maxTokens: 800
              })
              charEntity.overallArc = updatedArc
            } catch {}
          }
          await em.flush()

          // Index embeddings for RAG
          if (isEmbeddingReady()) {
            for (const cc of chapterChars) {
              const charEntity = await em.findOne(CharacterSchema, {
                id: getEntityId(cc.character)
              })
              if (!charEntity) continue
              const novelId = getEntityId(task.novel)
              if (cc.chapterStory) {
                await indexCharacterEvent(charEntity.id, chapter.id, novelId, cc.chapterStory, 'chapter_story').catch(() => {})
              }
              if (charEntity.overallArc) {
                await indexCharacterEvent(charEntity.id, null, novelId, charEntity.overallArc, 'overall_arc').catch(() => {})
              }
            }
          }
        }
      }
    }

    if (task.type === 'consistency_check' && task.chapter) {
      const chapterId = getEntityId(task.chapter)
      const novelId = getEntityId(task.novel)
      const chapter = await em.findOne(ChapterSchema, { id: chapterId })
      if (chapter) {
        const novelEntity = await em.findOne('Novel', { id: novelId }) as any
        const userId = novelEntity ? getEntityId(novelEntity.user) : 0
        if (userId) {
          const issues = await runConsistencyCheck(em, userId, novelId, chapterId)
          result = `Found ${issues.length} consistency issues`
        }
      }
    }

    if (task.type === 'generate_arc') {
      const novelId = getEntityId(task.novel)
      const allChapters = await em.find(ChapterSchema, {
        novel: novelId,
        deletedAt: null,
        summary: { $ne: null }
      }, { orderBy: { chapterNumber: 'ASC' } })

      const ARC_GROUP_SIZE = 10
      const totalChapters = allChapters.length

      if (totalChapters >= ARC_GROUP_SIZE) {
        const aiConfig = await em.findOne(AiConfigSchema, { purpose: 'extraction' })
        if (aiConfig) {
          const arcCount = Math.floor(totalChapters / ARC_GROUP_SIZE)
          for (let i = 0; i < arcCount; i++) {
            const startIdx = i * ARC_GROUP_SIZE
            const endIdx = startIdx + ARC_GROUP_SIZE
            const group = allChapters.slice(startIdx, endIdx)
            const startChapter = group[0]!.chapterNumber
            const endChapter = group[group.length - 1]!.chapterNumber

            const existing = await em.findOne(StoryArcSchema, {
              novel: novelId,
              startChapter,
              endChapter
            })
            if (existing) continue

            const summaries = group
              .filter(ch => ch.summary)
              .map(ch => ({ chapterNumber: ch.chapterNumber, title: ch.title, summary: ch.summary! }))

            if (summaries.length < 3) continue

            const messages = buildStoryArcPrompt(summaries, startChapter, endChapter)
            const arcSummary = await callAi({
              apiUrl: aiConfig.apiUrl,
              apiKey: aiConfig.apiKey,
              model: aiConfig.model,
              messages,
              temperature: 0.3,
              maxTokens: 500
            })

            em.create(StoryArcSchema, {
              novel: novelId,
              title: `第${startChapter}-${endChapter}章`,
              summary: arcSummary,
              startChapter,
              endChapter
            })
          }
          await em.flush()
          result = `Generated ${arcCount} arc summaries`
        }
      }
    }

    await em.nativeUpdate(
      GenerationTaskSchema,
      { id: task.id },
      {
        status: 'completed',
        result,
        completedAt: new Date()
      }
    )
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown task error'
    const retryCount = ((task.retryCount as number) || 0) + 1
    if (retryCount < MAX_RETRIES) {
      await em.nativeUpdate(
        GenerationTaskSchema,
        { id: task.id },
        {
          status: 'pending',
          retryCount,
          error: errorMessage
        }
      )
    } else {
      await em.nativeUpdate(
        GenerationTaskSchema,
        { id: task.id },
        {
          status: 'failed',
          error: errorMessage,
          retryCount
        }
      )
    }
  }
}

export async function enqueuePostProcessing(
  novelId: number,
  chapterId: number
): Promise<void> {
  const em = getOrm().em.fork()

  for (const type of POST_PROCESSING_TYPES) {
    const existing = await em.findOne(GenerationTaskSchema, {
      novel: novelId,
      chapter: chapterId,
      type,
      status: { $in: ['pending', 'running'] }
    })
    if (!existing) {
      em.create(GenerationTaskSchema, {
        novel: novelId,
        chapter: chapterId,
        type,
        status: 'pending'
      })
    }
  }

  // Trigger arc generation when chapter count is a multiple of 10
  const chapterCount = await em.count(ChapterSchema, { novel: novelId, deletedAt: null })
  if (chapterCount > 0 && chapterCount % 10 === 0) {
    const existingArcTask = await em.findOne(GenerationTaskSchema, {
      novel: novelId,
      type: 'generate_arc',
      status: { $in: ['pending', 'running'] }
    })
    if (!existingArcTask) {
      em.create(GenerationTaskSchema, {
        novel: novelId,
        chapter: chapterId,
        type: 'generate_arc',
        status: 'pending'
      })
    }
  }

  await em.flush()

  setTimeout(() => processPendingTasks(), 1000)
}

export async function processPendingTasks(): Promise<void> {
  const em = getOrm().em.fork()

  const pending = await em.find(
    GenerationTaskSchema,
    { status: 'pending' },
    { limit: 5 }
  )

  for (const task of pending) {
    await processTask(task)
  }
}

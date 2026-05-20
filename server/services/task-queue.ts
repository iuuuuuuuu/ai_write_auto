import { getOrm } from '../database'
import { callAi } from '../utils/ai-client'
import {
  buildSummaryPrompt,
  buildCharacterExtractionPrompt
} from '../utils/ai-prompts'
import {
  GenerationTaskSchema,
  ChapterSchema,
  AiConfigSchema,
  CharacterSchema,
  ChapterCharacterSchema,
  CharacterAppearanceSchema
} from '../database/entities'
import type { GenerationTask } from '../database/entities'

const MAX_RETRIES = 3
const POST_PROCESSING_TYPES = ['extract_summary', 'extract_characters']

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

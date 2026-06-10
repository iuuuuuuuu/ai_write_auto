import { createHash } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/core'
import { streamAi, toAiOptions } from '../utils/ai-client'
import {
  recordUsage,
  estimateTokens,
  dynamicMaxTokens
} from '../utils/ai-stream'
import { resolveNovelAiConfig } from '../utils/ai-configs'
import { parsePartialJsonArray } from '../utils/json-salvage'
import { buildCharacterStateChangeExtractionPrompt } from '../utils/ai-prompts'
import {
  ChapterSchema,
  CharacterSchema,
  CharacterStateChangeSchema,
  CharacterStateSnapshotSchema,
  NovelSchema,
  type Chapter,
  type Character,
  type CharacterStateChange,
  type Novel
} from '../database/entities'

export const CHARACTER_STATE_CHANGE_TYPES = [
  'description',
  'traits',
  'relationships',
  'currentState',
  'realName',
  'displayTitle',
  'rolePosition',
  'storyRole',
  'overallArc'
] as const

export type CharacterStateChangeType =
  (typeof CHARACTER_STATE_CHANGE_TYPES)[number]

export const CHARACTER_STATE_CHANGE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  REVERTED: 'reverted'
} as const

export const CHARACTER_STATE_CHANGE_SOURCE = {
  AI: 'ai',
  MANUAL: 'manual'
} as const

const AUTO_ACCEPT_CONFIDENCE = 0.8
const CHARACTER_PROFILE_FIELDS = new Set<string>(CHARACTER_STATE_CHANGE_TYPES)

export interface CharacterStateChangeDto {
  id: number
  novelId: number
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  characterId: number
  characterName: string
  relatedCharacterId: number | null
  relatedCharacterName: string | null
  changeType: CharacterStateChangeType
  beforeValue: string | null
  afterValue: string
  reason: string | null
  evidenceQuote: string | null
  confidence: string | null
  status: CharacterStateChange['status']
  source: CharacterStateChange['source']
  contentHash: string | null
  isStale: boolean
  createdAt: Date
  updatedAt: Date
}

interface ExtractRawChange {
  characterId: number
  characterName: string | null
  relatedCharacterId: number | null
  relatedCharacterName: string | null
  changeType: CharacterStateChangeType
  beforeValue: string | null
  afterValue: string
  reason: string | null
  evidenceQuote: string
  confidence: number
}

export interface ExtractCharacterStateChangesResult {
  created: number
  accepted: number
  pending: number
  skipped: number
  changes: CharacterStateChangeDto[]
}

export interface CreateManualCharacterStateChangeInput {
  novelId: number
  chapterId: number
  characterId: number
  relatedCharacterId?: number | null
  changeType: CharacterStateChangeType
  beforeValue?: string | null
  afterValue: string
  reason?: string | null
  evidenceQuote?: string | null
}

export interface UpdateCharacterStateChangeInput {
  relatedCharacterId?: number | null
  changeType?: CharacterStateChangeType
  beforeValue?: string | null
  afterValue?: string
  reason?: string | null
  evidenceQuote?: string | null
  status?: CharacterStateChange['status']
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isChangeType(value: unknown): value is CharacterStateChangeType {
  return typeof value === 'string' && CHARACTER_PROFILE_FIELDS.has(value)
}

function hashChange(input: {
  chapterId: number
  characterId: number
  relatedCharacterId: number | null
  changeType: string
  afterValue: string
  evidenceQuote: string | null
}): string {
  return createHash('sha1')
    .update(
      [
        input.chapterId,
        input.characterId,
        input.relatedCharacterId || 0,
        input.changeType,
        input.afterValue,
        input.evidenceQuote || ''
      ].join('|')
    )
    .digest('hex')
    .slice(0, 32)
}

function parseExtractedStateChanges(raw: string): ExtractRawChange[] {
  return parsePartialJsonArray(raw)
    .map((item): ExtractRawChange | null => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>
      const characterId = normalizeNumber(source.characterId)
      const changeType = source.changeType
      const afterValue = normalizeString(source.afterValue)
      const evidenceQuote = normalizeString(source.evidenceQuote)
      if (
        !characterId ||
        !isChangeType(changeType) ||
        !afterValue ||
        !evidenceQuote
      ) {
        return null
      }

      return {
        characterId,
        characterName: normalizeString(source.characterName),
        relatedCharacterId: normalizeNumber(source.relatedCharacterId),
        relatedCharacterName: normalizeString(source.relatedCharacterName),
        changeType,
        beforeValue: normalizeString(source.beforeValue),
        afterValue,
        reason: normalizeString(source.reason),
        evidenceQuote,
        confidence: Math.max(
          0,
          Math.min(1, normalizeNumber(source.confidence) ?? 0)
        )
      }
    })
    .filter((item): item is ExtractRawChange => Boolean(item))
}

function getCharacterFieldValue(
  character: Character,
  changeType: CharacterStateChangeType
): string | null {
  const value = character[changeType]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function setCharacterFieldValue(
  character: Character,
  changeType: CharacterStateChangeType,
  value: string | null
): void {
  character[changeType] = value
}

function changeToDto(change: CharacterStateChange): CharacterStateChangeDto {
  const novel = change.novel as Novel
  const chapter = change.chapter as Chapter
  const character = change.character as Character
  const relatedCharacter = change.relatedCharacter as Character | null
  const isStale =
    change.chapterUpdatedAtSnapshot && chapter?.updatedAt ?
      change.chapterUpdatedAtSnapshot.getTime() !== chapter.updatedAt.getTime()
    : false

  return {
    id: change.id,
    novelId: novel.id,
    chapterId: chapter.id,
    chapterNumber: chapter.chapterNumber,
    chapterTitle: chapter.title,
    characterId: character.id,
    characterName: character.name,
    relatedCharacterId: relatedCharacter?.id ?? null,
    relatedCharacterName: relatedCharacter?.name ?? null,
    changeType: change.changeType as CharacterStateChangeType,
    beforeValue: change.beforeValue,
    afterValue: change.afterValue,
    reason: change.reason,
    evidenceQuote: change.evidenceQuote,
    confidence: change.confidence,
    status: change.status,
    source: change.source,
    contentHash: change.contentHash,
    isStale,
    createdAt: change.createdAt,
    updatedAt: change.updatedAt
  }
}

async function refreshCharacterSnapshot(
  em: EntityManager,
  characterId: number,
  chapterId: number
): Promise<void> {
  const character = await em.findOne(CharacterSchema, { id: characterId })
  const chapter = await em.findOne(ChapterSchema, { id: chapterId })
  if (!character || !chapter) return

  const acceptedChanges = await em.find(
    CharacterStateChangeSchema,
    {
      character: characterId,
      status: CHARACTER_STATE_CHANGE_STATUS.ACCEPTED
    },
    {
      populate: ['chapter'],
      orderBy: { id: 'ASC' }
    }
  )

  const sourceChanges = acceptedChanges.filter(
    (change) =>
      (change.chapter as Chapter).chapterNumber <= chapter.chapterNumber
  )
  const state = {
    description: character.description,
    traits: character.traits,
    relationships: character.relationships,
    currentState: character.currentState,
    realName: character.realName,
    displayTitle: character.displayTitle,
    rolePosition: character.rolePosition,
    storyRole: character.storyRole,
    overallArc: character.overallArc
  }
  const stateJson = JSON.stringify(state)
  const contentHash = createHash('sha1')
    .update(stateJson)
    .digest('hex')
    .slice(0, 32)
  const sourceChangeIds = JSON.stringify(
    sourceChanges.map((change) => change.id)
  )

  const existing = await em.findOne(CharacterStateSnapshotSchema, {
    character: characterId,
    chapter: chapterId
  })

  if (existing) {
    existing.stateJson = stateJson
    existing.sourceChangeIds = sourceChangeIds
    existing.contentHash = contentHash
  } else {
    em.create(CharacterStateSnapshotSchema, {
      novel: (chapter.novel as Novel).id,
      chapter: chapterId,
      character: characterId,
      stateJson,
      sourceChangeIds,
      contentHash
    })
  }
}

async function syncAcceptedChangeToCharacter(
  em: EntityManager,
  change: CharacterStateChange
): Promise<void> {
  const character = await em.findOne(CharacterSchema, {
    id: change.character.id
  })
  if (!character) return
  setCharacterFieldValue(
    character,
    change.changeType as CharacterStateChangeType,
    change.afterValue
  )
}

async function restoreCharacterFieldFromHistory(
  em: EntityManager,
  change: CharacterStateChange
): Promise<void> {
  const characterId = change.character.id
  const character = await em.findOne(CharacterSchema, { id: characterId })
  if (!character) return

  const previous = await em.find(
    CharacterStateChangeSchema,
    {
      character: characterId,
      changeType: change.changeType,
      status: CHARACTER_STATE_CHANGE_STATUS.ACCEPTED,
      id: { $ne: change.id }
    },
    { orderBy: { id: 'DESC' }, limit: 1 }
  )
  const fallback = previous[0]?.afterValue ?? change.beforeValue ?? null
  setCharacterFieldValue(
    character,
    change.changeType as CharacterStateChangeType,
    fallback
  )
}

export async function listCharacterStateChanges(
  em: EntityManager,
  filters: {
    novelId: number
    characterId?: number
    chapterId?: number
    status?: CharacterStateChange['status']
  }
): Promise<CharacterStateChangeDto[]> {
  const where: Record<string, unknown> = { novel: filters.novelId }
  if (filters.characterId) where.character = filters.characterId
  if (filters.chapterId) where.chapter = filters.chapterId
  if (filters.status) where.status = filters.status

  const changes = await em.find(CharacterStateChangeSchema, where, {
    populate: ['novel', 'chapter', 'character', 'relatedCharacter'],
    orderBy: { id: 'DESC' }
  })
  return changes.map(changeToDto)
}

export async function extractCharacterStateChangesForChapter(
  em: EntityManager,
  input: {
    userId: number
    novelId: number
    chapterId: number
    replaceAi?: boolean
  }
): Promise<ExtractCharacterStateChangesResult> {
  const novel = await em.findOne(NovelSchema, {
    id: input.novelId,
    user: input.userId,
    deletedAt: null
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(
    ChapterSchema,
    { id: input.chapterId, novel: input.novelId, deletedAt: null },
    { populate: ['content'] }
  )
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  if (!chapter.content?.trim()) {
    throw createError({
      statusCode: 400,
      message: '章节内容为空，无法分析人物变化'
    })
  }

  if (input.replaceAi) {
    await em.nativeUpdate(
      CharacterStateChangeSchema,
      {
        novel: input.novelId,
        chapter: input.chapterId,
        source: CHARACTER_STATE_CHANGE_SOURCE.AI,
        status: CHARACTER_STATE_CHANGE_STATUS.PENDING
      },
      { status: CHARACTER_STATE_CHANGE_STATUS.REJECTED }
    )
  }

  const characters = await em.find(CharacterSchema, { novel: input.novelId })
  if (!characters.length) {
    return { created: 0, accepted: 0, pending: 0, skipped: 0, changes: [] }
  }

  const aiConfig = await resolveNovelAiConfig(
    em,
    input.userId,
    input.novelId,
    'extraction'
  )
  const messages = buildCharacterStateChangeExtractionPrompt({
    novel: {
      title: novel.title,
      genre: novel.genre,
      description: novel.description,
      worldSetting: novel.worldSetting,
      styleGuide: novel.styleGuide
    },
    chapter: {
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      summary: chapter.summary,
      content: chapter.content
    },
    characters: characters.map((character) => ({
      id: character.id,
      name: character.name,
      description: character.description,
      traits: character.traits,
      relationships: character.relationships,
      currentState: character.currentState,
      realName: character.realName,
      displayTitle: character.displayTitle,
      rolePosition: character.rolePosition,
      storyRole: character.storyRole,
      overallArc: character.overallArc
    }))
  })

  let aiContent = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.2,
      maxTokens: dynamicMaxTokens(estimateTokens(chapter.content) * 0.4, {
        floor: 1800,
        cap: 5000
      }),
      tracking: {
        userId: input.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'extraction',
        scenario: 'character_state_extract',
        source: 'service',
        novelId: input.novelId,
        chapterId: input.chapterId
      }
    })
  )) {
    if (chunk.content) aiContent += chunk.content
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
  }

  await recordUsage(
    {
      em,
      userId: input.userId,
      configId: aiConfig.configId,
      model: aiConfig.model
    },
    inputTokens,
    outputTokens
  )

  const characterMap = new Map(
    characters.map((character) => [character.id, character])
  )
  const rawChanges = parseExtractedStateChanges(aiContent)
  const createdChanges: CharacterStateChange[] = []
  let skipped = 0
  let accepted = 0
  let pending = 0

  for (const rawChange of rawChanges) {
    const character = characterMap.get(rawChange.characterId)
    if (!character) {
      skipped += 1
      continue
    }
    const relatedCharacter =
      rawChange.relatedCharacterId ?
        characterMap.get(rawChange.relatedCharacterId) || null
      : null
    const contentHash = hashChange({
      chapterId: chapter.id,
      characterId: character.id,
      relatedCharacterId: relatedCharacter?.id ?? null,
      changeType: rawChange.changeType,
      afterValue: rawChange.afterValue,
      evidenceQuote: rawChange.evidenceQuote
    })
    const existing = await em.findOne(CharacterStateChangeSchema, {
      novel: input.novelId,
      contentHash
    })
    if (existing) {
      skipped += 1
      continue
    }

    const status =
      rawChange.confidence >= AUTO_ACCEPT_CONFIDENCE ?
        CHARACTER_STATE_CHANGE_STATUS.ACCEPTED
      : CHARACTER_STATE_CHANGE_STATUS.PENDING
    const beforeValue =
      rawChange.beforeValue ??
      getCharacterFieldValue(character, rawChange.changeType)
    const change = em.create(CharacterStateChangeSchema, {
      novel: input.novelId,
      chapter: chapter.id,
      character: character.id,
      relatedCharacter: relatedCharacter?.id ?? null,
      changeType: rawChange.changeType,
      beforeValue,
      afterValue: rawChange.afterValue,
      reason: rawChange.reason,
      evidenceQuote: rawChange.evidenceQuote,
      confidence: String(rawChange.confidence),
      status,
      source: CHARACTER_STATE_CHANGE_SOURCE.AI,
      contentHash,
      chapterUpdatedAtSnapshot: chapter.updatedAt
    })

    if (status === CHARACTER_STATE_CHANGE_STATUS.ACCEPTED) {
      setCharacterFieldValue(
        character,
        rawChange.changeType,
        rawChange.afterValue
      )
      accepted += 1
    } else {
      pending += 1
    }
    createdChanges.push(change)
  }

  await em.flush()
  for (const change of createdChanges) {
    if (change.status === CHARACTER_STATE_CHANGE_STATUS.ACCEPTED) {
      await refreshCharacterSnapshot(em, change.character.id, change.chapter.id)
    }
  }
  await em.flush()

  const changes = await em.find(
    CharacterStateChangeSchema,
    { id: { $in: createdChanges.map((change) => change.id) } },
    {
      populate: ['novel', 'chapter', 'character', 'relatedCharacter'],
      orderBy: { id: 'DESC' }
    }
  )

  return {
    created: createdChanges.length,
    accepted,
    pending,
    skipped,
    changes: changes.map(changeToDto)
  }
}

export async function createManualCharacterStateChange(
  em: EntityManager,
  input: CreateManualCharacterStateChangeInput
): Promise<CharacterStateChangeDto> {
  if (!input.afterValue.trim()) {
    throw createError({ statusCode: 400, message: '变化内容不能为空' })
  }

  const character = await em.findOne(CharacterSchema, {
    id: input.characterId,
    novel: input.novelId
  })
  const chapter = await em.findOne(ChapterSchema, {
    id: input.chapterId,
    novel: input.novelId,
    deletedAt: null
  })
  if (!character)
    throw createError({ statusCode: 404, message: 'Character not found' })
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })

  let relatedCharacter: Character | null = null
  if (input.relatedCharacterId) {
    relatedCharacter = await em.findOne(CharacterSchema, {
      id: input.relatedCharacterId,
      novel: input.novelId
    })
    if (!relatedCharacter) {
      throw createError({
        statusCode: 404,
        message: 'Related character not found'
      })
    }
  }

  const contentHash = hashChange({
    chapterId: chapter.id,
    characterId: character.id,
    relatedCharacterId: relatedCharacter?.id ?? null,
    changeType: input.changeType,
    afterValue: input.afterValue.trim(),
    evidenceQuote: input.evidenceQuote || null
  })

  const change = em.create(CharacterStateChangeSchema, {
    novel: input.novelId,
    chapter: chapter.id,
    character: character.id,
    relatedCharacter: relatedCharacter?.id ?? null,
    changeType: input.changeType,
    beforeValue:
      input.beforeValue ?? getCharacterFieldValue(character, input.changeType),
    afterValue: input.afterValue.trim(),
    reason: input.reason?.trim() || null,
    evidenceQuote: input.evidenceQuote?.trim() || null,
    confidence: '1',
    status: CHARACTER_STATE_CHANGE_STATUS.ACCEPTED,
    source: CHARACTER_STATE_CHANGE_SOURCE.MANUAL,
    contentHash,
    chapterUpdatedAtSnapshot: chapter.updatedAt
  })
  await syncAcceptedChangeToCharacter(em, change)
  await em.flush()
  await refreshCharacterSnapshot(em, character.id, chapter.id)
  await em.flush()

  const created = await em.findOneOrFail(
    CharacterStateChangeSchema,
    { id: change.id },
    { populate: ['novel', 'chapter', 'character', 'relatedCharacter'] }
  )
  return changeToDto(created)
}

export async function updateCharacterStateChange(
  em: EntityManager,
  changeId: number,
  input: UpdateCharacterStateChangeInput
): Promise<CharacterStateChangeDto> {
  const change = await em.findOne(
    CharacterStateChangeSchema,
    { id: changeId },
    { populate: ['novel', 'chapter', 'character', 'relatedCharacter'] }
  )
  if (!change)
    throw createError({ statusCode: 404, message: 'Change not found' })

  if (input.relatedCharacterId !== undefined) {
    if (input.relatedCharacterId === null) {
      change.relatedCharacter = null
    } else {
      const related = await em.findOne(CharacterSchema, {
        id: input.relatedCharacterId,
        novel: change.novel.id
      })
      if (!related)
        throw createError({
          statusCode: 404,
          message: 'Related character not found'
        })
      change.relatedCharacter = related
    }
  }
  if (input.changeType !== undefined) change.changeType = input.changeType
  if (input.beforeValue !== undefined)
    change.beforeValue = input.beforeValue || null
  if (input.afterValue !== undefined) {
    if (!input.afterValue.trim()) {
      throw createError({ statusCode: 400, message: '变化内容不能为空' })
    }
    change.afterValue = input.afterValue.trim()
  }
  if (input.reason !== undefined) change.reason = input.reason || null
  if (input.evidenceQuote !== undefined) {
    change.evidenceQuote = input.evidenceQuote || null
  }
  if (input.status !== undefined) change.status = input.status

  change.contentHash = hashChange({
    chapterId: change.chapter.id,
    characterId: change.character.id,
    relatedCharacterId: change.relatedCharacter?.id ?? null,
    changeType: change.changeType,
    afterValue: change.afterValue,
    evidenceQuote: change.evidenceQuote
  })

  if (change.status === CHARACTER_STATE_CHANGE_STATUS.ACCEPTED) {
    await syncAcceptedChangeToCharacter(em, change)
  }
  await em.flush()
  await refreshCharacterSnapshot(em, change.character.id, change.chapter.id)
  await em.flush()

  return changeToDto(change)
}

export async function setCharacterStateChangeStatus(
  em: EntityManager,
  changeId: number,
  status: CharacterStateChange['status']
): Promise<CharacterStateChangeDto> {
  const change = await em.findOne(
    CharacterStateChangeSchema,
    { id: changeId },
    { populate: ['novel', 'chapter', 'character', 'relatedCharacter'] }
  )
  if (!change)
    throw createError({ statusCode: 404, message: 'Change not found' })

  change.status = status
  if (status === CHARACTER_STATE_CHANGE_STATUS.ACCEPTED) {
    await syncAcceptedChangeToCharacter(em, change)
  }
  if (status === CHARACTER_STATE_CHANGE_STATUS.REVERTED) {
    await restoreCharacterFieldFromHistory(em, change)
  }

  await em.flush()
  await refreshCharacterSnapshot(em, change.character.id, change.chapter.id)
  await em.flush()

  return changeToDto(change)
}

export async function deleteCharacterStateChange(
  em: EntityManager,
  changeId: number
): Promise<{ success: true }> {
  const change = await em.findOne(
    CharacterStateChangeSchema,
    { id: changeId },
    { populate: ['chapter', 'character'] }
  )
  if (!change)
    throw createError({ statusCode: 404, message: 'Change not found' })

  const characterId = change.character.id
  const chapterId = change.chapter.id
  const shouldRestore = change.status === CHARACTER_STATE_CHANGE_STATUS.ACCEPTED
  if (shouldRestore) await restoreCharacterFieldFromHistory(em, change)
  em.remove(change)
  await em.flush()
  await refreshCharacterSnapshot(em, characterId, chapterId)
  await em.flush()
  return { success: true }
}

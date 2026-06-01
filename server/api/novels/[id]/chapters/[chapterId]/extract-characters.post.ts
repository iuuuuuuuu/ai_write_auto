import { z } from 'zod'
import { streamAi, toAiOptions } from '~~/server/utils/ai-client'
import { recordUsage } from '~~/server/utils/ai-stream'
import { resolveNovelAiConfig } from '~~/server/utils/ai-configs'
import { buildCharacterExtractionPrompt } from '~~/server/utils/ai-prompts'
import {
  ChapterSchema, NovelSchema, CharacterSchema,
  ChapterCharacterSchema, CharacterAppearanceSchema
} from '~~/server/database/entities'

type ExtractedCharacterRole = 'main' | 'supporting' | 'mentioned'

interface ExtractedAppearance {
  snippet: string | null
  positionStart: number | null
  positionEnd: number | null
  background: string | null
}

interface ExtractedCharacter {
  name: string
  description: string | null
  traits: string | null
  currentState: string | null
  role: ExtractedCharacterRole
  appearances: ExtractedAppearance[]
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
  const cleaned = result.replace(/^```(?:json|JSON)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim()
  // Try parsing the full JSON first
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // If truncated, try to salvage by finding the last complete object
    const lastClose = cleaned.lastIndexOf('}')
    if (lastClose > 0) {
      const truncated = cleaned.slice(0, lastClose + 1)
      // Find the opening bracket
      const openBracket = truncated.indexOf('[')
      if (openBracket >= 0) {
        // Close any open string, close any open objects, close the array
        let fix = truncated.slice(openBracket)
        // Count open braces vs close braces
        const openBraces = (fix.match(/{/g) || []).length
        const closeBraces = (fix.match(/}/g) || []).length
        // If a string is open (odd number of unescaped quotes), close it
        const inString = fix.split('"').length % 2 === 0
        if (inString) fix += '"'
        for (let i = 0; i < openBraces - closeBraces; i++) fix += '}'
        fix += ']'
        parsed = JSON.parse(fix)
      }
    }
    if (!parsed) {
      throw new Error(`AI 返回的 JSON 格式不完整，原始内容前200字：${cleaned.slice(0, 200)}`)
    }
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Character extraction result must be a JSON array')
  }

  return parsed
    .map((item): ExtractedCharacter | null => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>
      const name = normalizeNullableString(source.name)
      if (!name) return null

      const rawAppearances = Array.isArray(source.appearances) ? source.appearances : []
      const appearances = rawAppearances
        .map((a): ExtractedAppearance | null => {
          if (!a || typeof a !== 'object') return null
          const s = a as Record<string, unknown>
          return {
            snippet: normalizeNullableString(s.snippet),
            positionStart: normalizeNullableNumber(s.positionStart),
            positionEnd: normalizeNullableNumber(s.positionEnd),
            background: normalizeNullableString(s.background)
          }
        })
        .filter((a): a is ExtractedAppearance => Boolean(a))

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

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(ChapterSchema, {
    id: chapterId,
    novel: novelId,
    deletedAt: null
  }, { populate: ['content'] })
  if (!chapter) throw createError({ statusCode: 404, message: 'Chapter not found' })
  if (!chapter.content) throw createError({ statusCode: 400, message: '章节内容为空，无法识别角色' })

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, novelId, 'extraction')

  const messages = buildCharacterExtractionPrompt(chapter.content)

  let aiContent = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(toAiOptions(aiConfig, {
    messages,
    temperature: 0.2,
    maxTokens: 4096
  }))) {
    if (chunk.content) aiContent += chunk.content
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
  }

  await recordUsage({ em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }, inputTokens, outputTokens)

  const chars = parseExtractedCharacters(aiContent)

  for (const char of chars) {
    const existing = await em.findOne(CharacterSchema, { novel: novelId, name: char.name })
    const character = existing || em.create(CharacterSchema, {
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
      existing.firstAppearanceChapter = existing.firstAppearanceChapter === null
        ? chapter.chapterNumber
        : Math.min(existing.firstAppearanceChapter, chapter.chapterNumber)
      existing.lastAppearanceChapter = existing.lastAppearanceChapter === null
        ? chapter.chapterNumber
        : Math.max(existing.lastAppearanceChapter, chapter.chapterNumber)
    }

    await em.flush()

    const assignment = await em.findOne(ChapterCharacterSchema, { chapter: chapter.id, character: character.id })
    if (assignment) {
      assignment.role = char.role
    } else {
      em.create(ChapterCharacterSchema, { chapter: chapter.id, character: character.id, role: char.role })
    }

    await em.nativeDelete(CharacterAppearanceSchema, { chapter: chapter.id, character: character.id })

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

  return { success: true, count: chars.length }
})

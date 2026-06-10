import { streamAi, toAiOptions } from '~~/server/utils/ai-client'
import {
  recordUsage,
  estimateTokens,
  dynamicMaxTokens
} from '~~/server/utils/ai-stream'
import { resolveNovelAiConfig } from '~~/server/utils/ai-configs'
import { buildCharacterExtractionPrompt } from '~~/server/utils/ai-prompts'
import { parseExtractedCharacters } from '~~/server/utils/character-extraction'
import {
  ChapterSchema,
  NovelSchema,
  CharacterSchema,
  ChapterCharacterSchema,
  CharacterAppearanceSchema
} from '~~/server/database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(
    ChapterSchema,
    {
      id: chapterId,
      novel: novelId,
      deletedAt: null
    },
    { populate: ['content'] }
  )
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  if (!chapter.content)
    throw createError({
      statusCode: 400,
      message: '章节内容为空，无法识别角色'
    })

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    novelId,
    'extraction'
  )

  const messages = buildCharacterExtractionPrompt(chapter.content)

  let aiContent = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.2,
      // 按正文长度动态给上限（角色清单随正文增长），避免长章节角色多被固定上限截断
      maxTokens: dynamicMaxTokens(estimateTokens(chapter.content) * 0.5, {
        floor: 2000,
        cap: 6000
      }),
      tracking: {
        userId: auth.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'extraction',
        scenario: 'character_extract',
        source: 'api_route',
        endpoint: '/api/novels/[id]/chapters/[chapterId]/extract-characters',
        novelId,
        chapterId
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
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model },
    inputTokens,
    outputTokens
  )

  const chars = parseExtractedCharacters(aiContent)

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
        : Math.min(existing.firstAppearanceChapter, chapter.chapterNumber)
      existing.lastAppearanceChapter =
        existing.lastAppearanceChapter === null ?
          chapter.chapterNumber
        : Math.max(existing.lastAppearanceChapter, chapter.chapterNumber)
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

  return { success: true, count: chars.length }
})

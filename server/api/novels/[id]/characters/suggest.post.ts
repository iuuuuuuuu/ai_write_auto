import { z } from 'zod'
import { streamAi, toAiOptions } from '../../../../utils/ai-client'
import {
  prepareBudgetedAiOptions,
  recordUsage,
  standardAiBudgetOptions
} from '../../../../utils/ai-stream'
import { buildCharacterGenerationPrompt } from '../../../../utils/ai-prompts'
import { parseJsonArrayLike } from '../../../../utils/json-salvage'
import { resolveNovelAiConfig } from '../../../../utils/ai-configs'
import {
  NovelSchema,
  NovelOutlineSchema,
  CharacterSchema
} from '../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const novelId = parseIntParam(event, 'id')

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const body = await readBody(event)
  const { count } = z
    .object({
      count: z.number().int().min(1).max(10).default(3)
    })
    .parse(body)

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    novelId,
    'extraction'
  )

  const existingCharacters = await em.find(CharacterSchema, { novel: novelId })
  const outlines = await em.find(
    NovelOutlineSchema,
    { novel: novelId },
    {
      orderBy: { chapterNumber: 'ASC' }
    }
  )

  const messages = buildCharacterGenerationPrompt({
    novel: {
      title: novel.title,
      description: novel.description ?? undefined,
      genre: novel.genre ?? undefined,
      worldSetting: novel.worldSetting ?? undefined,
      styleGuide: novel.styleGuide ?? undefined
    },
    existingCharacters: existingCharacters.map((c) => ({
      name: c.name,
      description: c.description ?? undefined,
      traits: c.traits ?? undefined,
      currentState: c.currentState ?? undefined
    })),
    outlines: outlines.map((o) => ({
      chapterNumber: o.chapterNumber,
      description: o.description
    })),
    count
  })
  const desiredOutputTokens = 4096
  const budgeted = prepareBudgetedAiOptions(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.5,
      thinkingEnabled: false,
      maxTokens: desiredOutputTokens,
      tracking: {
        userId: auth.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'extraction',
        scenario: 'character_suggest',
        source: 'api_route',
        endpoint: '/api/novels/[id]/characters/suggest',
        novelId
      }
    }),
    standardAiBudgetOptions(aiConfig.contextWindowTokens, desiredOutputTokens)
  )

  let result = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(budgeted.options)) {
    if (chunk.content) result += chunk.content
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
  }

  await recordUsage(
    {
      em,
      userId: auth.userId,
      configId: aiConfig.configId,
      model: aiConfig.model
    },
    inputTokens,
    outputTokens
  )

  const parsed = parseJsonArrayLike(result)
  if (!parsed.length) {
    throw createError({
      statusCode: 500,
      message: 'AI 返回格式无效，请重试'
    })
  }

  const suggestions = []
  const existingNames = new Set(existingCharacters.map((c) => c.name))

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const source = item as Record<string, unknown>
    const name = typeof source.name === 'string' ? source.name.trim() : ''
    if (!name || existingNames.has(name)) continue

    suggestions.push({
      name,
      description:
        typeof source.description === 'string' ? source.description : null,
      traits: typeof source.traits === 'string' ? source.traits : null,
      relationships:
        typeof source.relationships === 'string' ? source.relationships : null,
      currentState:
        typeof source.currentState === 'string' ? source.currentState : null,
      role: typeof source.role === 'string' ? source.role : 'supporting'
    })
  }

  return { suggestions }
})

import { z } from 'zod'
import { streamAi, toAiOptions } from '../../../../utils/ai-client'
import { recordUsage } from '../../../../utils/ai-stream'
import { buildCharacterGenerationPrompt } from '../../../../utils/ai-prompts'
import {
  NovelSchema,
  NovelOutlineSchema,
  CharacterSchema,
  AiConfigSchema
} from '../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const novelId = parseIntParam(event, 'id')

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const body = await readBody(event)
  const { count } = z.object({
    count: z.number().int().min(1).max(10).default(3)
  }).parse(body)

  const configEntry = await em.findOne(AiConfigSchema, { purpose: 'extraction', enabled: true }, { populate: ['aiModel', 'aiModel.provider'] })
  if (!configEntry || !configEntry.aiModel) {
    throw createError({ statusCode: 400, message: '未找到信息提取的 AI 配置' })
  }
  const aiModel = configEntry.aiModel as any
  if (!aiModel.enabled) throw createError({ statusCode: 400, message: `模型「${aiModel.name}」已被禁用` })
  const provider = aiModel.provider
  const aiConfig = { apiUrl: provider.apiUrl, apiKey: provider.apiKey, model: aiModel.model, modelId: aiModel.id }

  const existingCharacters = await em.find(CharacterSchema, { novel: novelId })
  const outlines = await em.find(NovelOutlineSchema, { novel: novelId }, {
    orderBy: { chapterNumber: 'ASC' }
  })

  const messages = buildCharacterGenerationPrompt({
    novel: {
      title: novel.title,
      description: novel.description ?? undefined,
      genre: novel.genre ?? undefined,
      worldSetting: novel.worldSetting ?? undefined,
      styleGuide: novel.styleGuide ?? undefined
    },
    existingCharacters: existingCharacters.map(c => ({
      name: c.name,
      description: c.description ?? undefined,
      traits: c.traits ?? undefined,
      currentState: c.currentState ?? undefined
    })),
    outlines: outlines.map(o => ({
      chapterNumber: o.chapterNumber,
      description: o.description
    })),
    count
  })

  let result = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(toAiOptions(aiConfig, {
    messages,
    temperature: 0.8,
    maxTokens: 4096
  }))) {
    if (chunk.content) result += chunk.content
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
  }

  await recordUsage({ em, userId: auth.userId, configId: configEntry.id, model: aiConfig.model }, inputTokens, outputTokens)

  const parsed: unknown = JSON.parse(result)
  if (!Array.isArray(parsed)) {
    throw createError({ statusCode: 500, message: 'AI returned invalid format' })
  }

  const suggestions = []
  const existingNames = new Set(existingCharacters.map(c => c.name))

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const source = item as Record<string, unknown>
    const name = typeof source.name === 'string' ? source.name.trim() : ''
    if (!name || existingNames.has(name)) continue

    suggestions.push({
      name,
      description: typeof source.description === 'string' ? source.description : null,
      traits: typeof source.traits === 'string' ? source.traits : null,
      relationships: typeof source.relationships === 'string' ? source.relationships : null,
      currentState: typeof source.currentState === 'string' ? source.currentState : null,
      role: typeof source.role === 'string' ? source.role : 'supporting'
    })
  }

  return { suggestions }
})

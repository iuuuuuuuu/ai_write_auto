import { z } from 'zod'
import { callAi } from '../../../../utils/ai-client'
import { buildCharacterGenerationPrompt } from '../../../../utils/ai-prompts'
import {
  NovelSchema,
  NovelOutlineSchema,
  CharacterSchema,
  AiConfigSchema,
  PromptTemplateSchema
} from '../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const novelId = parseInt(getRouterParam(event, 'id') as string)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const body = await readBody(event)
  const { count, promptTemplateId } = z.object({
    count: z.number().int().min(1).max(20),
    promptTemplateId: z.number().int().optional()
  }).parse(body)

  let customPrompt: string | undefined
  if (promptTemplateId) {
    const template = await em.findOne(PromptTemplateSchema, {
      id: promptTemplateId,
      category: 'character_generation' as any
    })
    if (template) {
      customPrompt = template.content
    }
  }

  const configEntry = await em.findOne(AiConfigSchema, { purpose: 'extraction', enabled: true }, { populate: ['aiModel'] })
  if (!configEntry || !configEntry.aiModel) {
    throw createError({ statusCode: 400, message: '未找到信息提取的 AI 配置' })
  }
  const aiModel = configEntry.aiModel as any
  if (!aiModel.enabled) throw createError({ statusCode: 400, message: `模型「${aiModel.name}」已被禁用` })
  const aiConfig = { apiUrl: aiModel.apiUrl, apiKey: aiModel.apiKey, model: aiModel.model }

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
    count,
    customPrompt
  })

  const result = await callAi({
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.8,
    maxTokens: 4096
  })

  const parsed: unknown = JSON.parse(result)
  if (!Array.isArray(parsed)) {
    throw createError({ statusCode: 500, message: 'AI returned invalid format' })
  }

  const created = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const source = item as Record<string, unknown>
    const name = typeof source.name === 'string' ? source.name.trim() : ''
    if (!name) continue

    const existing = await em.findOne(CharacterSchema, { novel: novelId, name })
    if (existing) continue

    const character = em.create(CharacterSchema, {
      novel: novelId,
      name,
      description: typeof source.description === 'string' ? source.description : null,
      traits: typeof source.traits === 'string' ? source.traits : null,
      relationships: typeof source.relationships === 'string' ? source.relationships : null,
      currentState: typeof source.currentState === 'string' ? source.currentState : null
    })
    created.push(character)
  }

  await em.flush()
  return { generated: created.length, characters: created }
})

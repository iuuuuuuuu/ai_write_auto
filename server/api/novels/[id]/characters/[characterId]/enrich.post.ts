import { z } from 'zod'
import { NovelSchema, CharacterSchema, NovelOutlineSchema } from '~~/server/database/entities'
import { callAiWithUsage } from '~~/server/utils/ai-client'
import { recordUsage } from '~~/server/utils/ai-stream'
import { resolveNovelAiConfig } from '~~/server/utils/ai-configs'
import { buildCharacterEnrichPrompt } from '~~/server/utils/ai-prompts'

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  traits: z.string().optional(),
  relationships: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const characterId = parseInt(getRouterParam(event, 'characterId')!)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const character = await em.findOne(CharacterSchema, { id: characterId, novel: novelId })
  if (!character) throw createError({ statusCode: 404, message: 'Character not found' })

  const body = await readBody(event)
  const result = bodySchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 400, message: '参数校验失败' })
  }
  const formData = result.data

  const emptyFields: string[] = []
  if (!formData.description?.trim()) emptyFields.push('description')
  if (!formData.traits?.trim()) emptyFields.push('traits')
  if (!formData.relationships?.trim()) emptyFields.push('relationships')

  if (emptyFields.length === 0) {
    return { enriched: {} }
  }

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, novelId, 'extraction')

  const existingCharacters = await em.find(CharacterSchema, { novel: novelId })
  const outlines = await em.find(NovelOutlineSchema, { novel: novelId }, {
    orderBy: { chapterNumber: 'ASC' }
  })

  const messages = buildCharacterEnrichPrompt({
    novel: {
      title: novel.title,
      description: novel.description ?? undefined,
      genre: novel.genre ?? undefined,
      worldSetting: novel.worldSetting ?? undefined,
      styleGuide: novel.styleGuide ?? undefined
    },
    character: {
      name: formData.name,
      description: formData.description?.trim() || undefined,
      traits: formData.traits?.trim() || undefined,
      relationships: formData.relationships?.trim() || undefined
    },
    existingCharacters: existingCharacters
      .filter(c => c.id !== characterId)
      .map(c => ({
        name: c.name,
        description: c.description ?? undefined,
        traits: c.traits ?? undefined,
        relationships: c.relationships ?? undefined
      })),
    outlines: outlines.map(o => ({
      chapterNumber: o.chapterNumber,
      description: o.description
    })),
    fieldsToEnrich: emptyFields
  })

  const { content: aiResult, inputTokens, outputTokens } = await callAiWithUsage({
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.7,
    maxTokens: 2048
  })

  await recordUsage({ em, userId: auth.userId, configId: aiConfig.configId, model: aiConfig.model }, inputTokens, outputTokens)

  let parsed: Record<string, string>
  try {
    const cleaned = aiResult.replace(/^```json?\n?|\n?```$/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw createError({ statusCode: 500, message: 'AI 返回格式无效，请重试' })
  }

  const enriched: Record<string, string> = {}
  for (const field of emptyFields) {
    if (parsed[field] && typeof parsed[field] === 'string') {
      enriched[field] = parsed[field]
    }
  }

  return { enriched }
})

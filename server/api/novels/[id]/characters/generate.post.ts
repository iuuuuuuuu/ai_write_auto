import { z } from 'zod'
import {
  createStreamResponse,
  dynamicMaxTokens
} from '../../../../utils/ai-stream'
import { toAiOptions } from '../../../../utils/ai-client'
import { buildCharacterGenerationPrompt } from '../../../../utils/ai-prompts'
import {
  NovelSchema,
  NovelOutlineSchema,
  CharacterSchema,
  PromptTemplateSchema
} from '../../../../database/entities'
import { resolveNovelAiConfig } from '../../../../utils/ai-configs'

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
  const { count, promptTemplateId } = z
    .object({
      count: z.number().int().min(1).max(20),
      promptTemplateId: z.number().int().optional()
    })
    .parse(body)

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

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    novelId,
    'generation'
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
    count,
    customPrompt
  })

  return createStreamResponse(
    event,
    {
      ...toAiOptions(aiConfig, {
        messages,
        temperature: 0.5,
        thinkingEnabled: false,
        maxTokens: dynamicMaxTokens(count * 650 + 800, {
          floor: 2000,
          cap: 10000
        }),
        tracking: {
          userId: auth.userId,
          configId: aiConfig.configId,
          modelId: aiConfig.modelId,
          purpose: 'generation',
          scenario: 'character_generate',
          source: 'api_route',
          endpoint: '/api/novels/[id]/characters/generate',
          novelId
        }
      })
    },
    {
      em,
      userId: auth.userId,
      configId: aiConfig.configId,
      model: aiConfig.model
    },
    { parseJsonResult: true }
  )
})

import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import { NovelSchema, AiConfigSchema } from '../../database/entities'

const updateNovelSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  genre: z.string().max(50).optional(),
  status: z.enum(['draft', 'in_progress', 'completed']).optional(),
  styleGuide: z.string().optional(),
  worldSetting: z.string().optional(),
  aiTemperature: z.string().optional(),
  aiExtraPrompt: z.string().optional(),
  aiConfigId: z.number().int().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)
  const data = updateNovelSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id,
    user: auth.userId,
    deletedAt: null,
  })

  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const { aiConfigId, ...rest } = data

  if (aiConfigId !== undefined) {
    if (aiConfigId === null) {
      (novel as any).aiConfig = null
    } else {
      const config = await em.findOne(AiConfigSchema, { id: aiConfigId, user: auth.userId })
      if (!config) throw createError({ statusCode: 400, message: 'AI config not found' })
      ;(novel as any).aiConfig = aiConfigId
    }
  }

  wrap(novel).assign({ ...rest, updatedAt: new Date() })
  await em.flush()

  return novel
})

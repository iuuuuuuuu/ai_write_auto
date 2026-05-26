import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import { NovelSchema, AiConfigSchema } from '../../database/entities'

const updateNovelSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200字').optional(),
  description: z.string().max(5000, '简介不能超过5000字').optional(),
  genre: z.string().max(50).optional(),
  status: z.enum(['draft', 'in_progress', 'completed']).optional(),
  styleGuide: z.string().max(10000, '风格指南不能超过10000字').optional(),
  worldSetting: z.string().max(20000, '世界观设定不能超过20000字').optional(),
  aiTemperature: z.string().optional(),
  aiExtraPrompt: z.string().max(5000, 'AI提示词不能超过5000字').optional(),
  aiConfigId: z.number().int().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id')!)
  const body = await readBody(event)

  const result = updateNovelSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    throw createError({ statusCode: 400, message: firstError?.message || '参数校验失败' })
  }

  const data = result.data
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

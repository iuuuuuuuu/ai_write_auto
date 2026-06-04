import { z } from 'zod'
import { NovelSchema } from '../../database/entities'
import { isNovelGenreValue } from '~~/shared/novel-catalog'

const createNovelSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200字'),
  description: z.string().max(5000, '简介不能超过5000字').optional(),
  genre: z
    .string()
    .max(50)
    .refine((genre) => isNovelGenreValue(genre), '类型不存在')
    .optional(),
  styleGuide: z.string().max(10000, '风格指南不能超过10000字').optional(),
  worldSetting: z.string().max(20000, '世界观设定不能超过20000字').optional(),
  aiTemperature: z.string().optional(),
  aiExtraPrompt: z.string().max(5000, 'AI提示词不能超过5000字').optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)

  const result = createNovelSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.issues[0]
    throw createError({
      statusCode: 400,
      message: firstError?.message || '参数校验失败'
    })
  }

  const data = result.data
  const em = useEm(event)

  const novel = em.create(NovelSchema, {
    user: auth.userId,
    title: data.title,
    description: data.description || null,
    genre: data.genre || null,
    styleGuide: data.styleGuide || null,
    worldSetting: data.worldSetting || null,
    aiTemperature: data.aiTemperature || null,
    aiExtraPrompt: data.aiExtraPrompt || null,
    status: 'draft'
  })

  await em.flush()
  return novel
})

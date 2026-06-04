import { z } from 'zod'
import { NovelTemplateSchema } from '../../database/entities'
import { isNovelGenreValue } from '~~/shared/novel-catalog'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const method = getMethod(event)

  if (method === 'GET') {
    const pagination = parsePagination(event)
    const [templates, total] = await Promise.all([
      em.find(
        NovelTemplateSchema,
        {},
        {
          limit: pagination.limit,
          offset: pagination.offset,
          orderBy: { id: 'DESC' }
        }
      ),
      em.count(NovelTemplateSchema, {})
    ])
    return paginatedResult(templates, total, pagination)
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = z
      .object({
        name: z.string().min(1).max(100),
        genre: z
          .string()
          .min(1)
          .max(50)
          .refine((genre) => isNovelGenreValue(genre), '类型不存在'),
        defaultStyleGuide: z.string().nullable().optional(),
        defaultAiPrompt: z.string().nullable().optional(),
        defaultTemperature: z.string().nullable().optional()
      })
      .parse(body)

    const template = em.create(NovelTemplateSchema, data)
    await em.flush()
    return template
  }
})

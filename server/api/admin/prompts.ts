import { z } from 'zod'
import { PromptTemplateSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const method = getMethod(event)

  if (method === 'GET') {
    const query = getQuery(event)
    const pagination = parsePagination(event)
    const category = query.category as string || ''

    const filter: Record<string, any> = { isSystem: true }
    if (category && category !== 'all') filter.category = category

    const [prompts, total] = await Promise.all([
      em.find(PromptTemplateSchema, filter, {
        limit: pagination.limit,
        offset: pagination.offset,
        orderBy: { createdAt: 'DESC' },
      }),
      em.count(PromptTemplateSchema, filter),
    ])
    return paginatedResult(prompts, total, pagination)
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = z.object({
      name: z.string().min(1).max(100),
      content: z.string().min(1),
      category: z.enum(['generation', 'rewrite', 'expand', 'custom']),
    }).parse(body)

    const prompt = em.create(PromptTemplateSchema, {
      ...data,
      isSystem: true,
      user: null,
    })
    await em.flush()
    return prompt
  }
})

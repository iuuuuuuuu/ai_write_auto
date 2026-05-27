import { z } from 'zod'
import { NovelTemplateSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const method = getMethod(event)
  const id = parseIntParam(event, 'id')

  const template = await em.findOne(NovelTemplateSchema, { id })
  if (!template) {
    throw createError({ statusCode: 404, message: 'Template not found' })
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const data = z.object({
      name: z.string().min(1).max(100).optional(),
      genre: z.string().min(1).max(50).optional(),
      defaultStyleGuide: z.string().nullable().optional(),
      defaultAiPrompt: z.string().nullable().optional(),
      defaultTemperature: z.string().nullable().optional(),
    }).parse(body)

    Object.assign(template, data)
    await em.flush()
    return template
  }

  if (method === 'DELETE') {
    await em.removeAndFlush(template)
    return { success: true }
  }
})

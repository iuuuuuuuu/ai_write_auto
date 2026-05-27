import { z } from 'zod'
import { PromptTemplateSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const method = getMethod(event)
  const id = parseIntParam(event, 'id')

  const prompt = await em.findOne(PromptTemplateSchema, { id, isSystem: true })
  if (!prompt) {
    throw createError({ statusCode: 404, message: 'Prompt template not found' })
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const data = z.object({
      name: z.string().min(1).max(100).optional(),
      content: z.string().min(1).optional(),
      category: z.enum(['generation', 'rewrite', 'expand', 'character_generation', 'custom']).optional(),
    }).parse(body)

    Object.assign(prompt, data)
    await em.flush()
    return prompt
  }

  if (method === 'DELETE') {
    await em.removeAndFlush(prompt)
    return { success: true }
  }
})

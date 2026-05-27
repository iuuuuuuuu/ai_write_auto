import { z } from 'zod'
import { AiConfigSchema } from '../../../database/entities'

const configUpdateSchema = z.object({
  enabled: z.boolean().optional(),
}).refine(data => data.enabled !== undefined, {
  message: 'At least one field must be provided',
})

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseIntParam(event, 'id')
  const body = await readBody(event)
  const parsed = configUpdateSchema.parse(body)

  const config = await em.findOne(AiConfigSchema, { id })
  if (!config) {
    throw createError({ statusCode: 404, message: 'Config not found' })
  }

  if (parsed.enabled !== undefined) {
    config.enabled = parsed.enabled
  }

  await em.flush()
  return { success: true, enabled: config.enabled }
})

import { z } from 'zod'
import { ModelCostRateSchema } from '../../database/entities'

const upsertSchema = z.object({
  id: z.number().int().positive().optional(),
  model: z.string().min(1).max(100),
  inputCostPer1k: z.string().regex(/^\d+(\.\d+)?$/),
  outputCostPer1k: z.string().regex(/^\d+(\.\d+)?$/)
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const rates = await em.find(ModelCostRateSchema, { user: auth.userId })
    return rates.map((r: any) => ({
      id: r.id,
      model: r.model,
      inputCostPer1k: r.inputCostPer1k,
      outputCostPer1k: r.outputCostPer1k,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const data = upsertSchema.parse(body)

    if (data.id) {
      const existing = await em.findOne(ModelCostRateSchema, { id: data.id, user: auth.userId })
      if (!existing) {
        throw createError({ statusCode: 404, message: 'Cost rate not found' })
      }
      await em.nativeUpdate(ModelCostRateSchema, { id: data.id }, {
        model: data.model,
        inputCostPer1k: data.inputCostPer1k,
        outputCostPer1k: data.outputCostPer1k,
        updatedAt: new Date()
      })
    } else {
      const existing = await em.findOne(ModelCostRateSchema, { user: auth.userId, model: data.model })
      if (existing) {
        await em.nativeUpdate(ModelCostRateSchema, { id: existing.id }, {
          inputCostPer1k: data.inputCostPer1k,
          outputCostPer1k: data.outputCostPer1k,
          updatedAt: new Date()
        })
      } else {
        em.create(ModelCostRateSchema, {
          user: auth.userId,
          model: data.model,
          inputCostPer1k: data.inputCostPer1k,
          outputCostPer1k: data.outputCostPer1k
        })
        await em.flush()
      }
    }

    return { success: true }
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = Number(query.id)
    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing id parameter' })
    }
    const existing = await em.findOne(ModelCostRateSchema, { id, user: auth.userId })
    if (!existing) {
      throw createError({ statusCode: 404, message: 'Cost rate not found' })
    }
    await em.removeAndFlush(existing)
    return { success: true }
  }
})

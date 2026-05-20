import { PromptTemplateSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const em = useEm(event)

  const prompts = await em.find(
    PromptTemplateSchema,
    { category: 'character_generation' as any, isSystem: true },
    { orderBy: { createdAt: 'DESC' } }
  )

  return prompts.map(p => ({
    id: p.id,
    name: p.name,
    content: p.content
  }))
})

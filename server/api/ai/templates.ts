import { z } from 'zod'

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  category: z.enum(['generation', 'rewrite', 'expand', 'custom']),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const templates = await em.find('PromptTemplate', {
      $or: [
        { user: auth.userId },
        { isSystem: true },
      ],
    })
    return templates
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = templateSchema.parse(body)

    const template = em.create('PromptTemplate', {
      user: auth.userId,
      name: data.name,
      content: data.content,
      category: data.category,
      isSystem: false,
    })
    await em.flush()

    return template
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = parseInt(query.id as string)

    await em.nativeDelete('PromptTemplate', { id, user: auth.userId })
    return { success: true }
  }
})

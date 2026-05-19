import { z } from 'zod'

const createNovelSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  genre: z.string().max(50).optional(),
  styleGuide: z.string().optional(),
  worldSetting: z.string().optional(),
  aiTemperature: z.string().optional(),
  aiExtraPrompt: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = createNovelSchema.parse(body)
  const em = useEm(event)

  const novel = em.create('Novel', {
    user: auth.userId,
    title: data.title,
    description: data.description || null,
    genre: data.genre || null,
    styleGuide: data.styleGuide || null,
    worldSetting: data.worldSetting || null,
    aiTemperature: data.aiTemperature || null,
    aiExtraPrompt: data.aiExtraPrompt || null,
    status: 'draft',
  })

  await em.flush()
  return novel
})

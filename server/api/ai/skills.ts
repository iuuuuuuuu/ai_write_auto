import { z } from 'zod'
import { WritingSkillSchema } from '../../database/entities'
import { serializeSkill } from '../../utils/writing-skills'

const fewShotSchema = z.object({
  scene: z.string().max(100),
  content: z.string().max(8000)
})

const skillBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  genre: z.string().max(50).nullable().optional(),
  systemAddon: z.string().max(8000).nullable().optional(),
  fewShots: z.array(fewShotSchema).max(10).optional(),
  checklist: z.array(z.string().max(300)).max(20).optional(),
  appliesTo: z.array(z.string().max(30)).max(10).optional(),
  enabled: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const method = getMethod(event)

  if (method === 'GET') {
    const skills = await em.find(
      WritingSkillSchema,
      { $or: [{ user: auth.userId }, { isSystem: true }] },
      { orderBy: { createdAt: 'ASC' } }
    )
    return skills.map(serializeSkill)
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = skillBodySchema.parse(body)
    const skill = em.create(WritingSkillSchema, {
      user: auth.userId,
      name: data.name,
      description: data.description ?? null,
      genre: data.genre ?? null,
      systemAddon: data.systemAddon ?? null,
      fewShots: JSON.stringify(data.fewShots ?? []),
      checklist: JSON.stringify(data.checklist ?? []),
      appliesTo: JSON.stringify(data.appliesTo ?? ['generation']),
      isSystem: false,
      enabled: data.enabled ?? true
    })
    await em.flush()
    return serializeSkill(skill)
  }
})

import { z } from 'zod'
import { WritingSkillSchema } from '../../../database/entities'
import { serializeSkill } from '../../../utils/writing-skills'

const fewShotSchema = z.object({
  scene: z.string().max(100),
  content: z.string().max(8000)
})

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
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
  const id = parseIntParam(event, 'id')

  // 仅能操作自己的技能包；系统预置只读，不可改删。
  const skill = await em.findOne(WritingSkillSchema, { id, user: auth.userId })
  if (!skill) {
    throw createError({
      statusCode: 404,
      message: '技能包不存在或不可修改（系统预置只读）'
    })
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const data = updateSchema.parse(body)
    if (data.name !== undefined) skill.name = data.name
    if (data.description !== undefined) skill.description = data.description
    if (data.genre !== undefined) skill.genre = data.genre
    if (data.systemAddon !== undefined) skill.systemAddon = data.systemAddon
    if (data.fewShots !== undefined)
      skill.fewShots = JSON.stringify(data.fewShots)
    if (data.checklist !== undefined)
      skill.checklist = JSON.stringify(data.checklist)
    if (data.appliesTo !== undefined)
      skill.appliesTo = JSON.stringify(data.appliesTo)
    if (data.enabled !== undefined) skill.enabled = data.enabled
    await em.flush()
    return serializeSkill(skill)
  }

  if (method === 'DELETE') {
    await em.removeAndFlush(skill)
    return { success: true }
  }
})

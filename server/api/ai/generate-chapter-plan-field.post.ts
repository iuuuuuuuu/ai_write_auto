import { z } from 'zod'
import { generateChapterWorkflowPlanField } from '../../services/chapter-workflow'

const supportedFields = [
  'goal',
  'conflict',
  'turningPoint',
  'beats',
  'mustInclude',
  'avoid',
  'interestHooks',
  'pacing',
  'protocol'
] as const

const chapterPlanFieldSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  chapterOutline: z.string().min(1),
  field: z.enum(supportedFields),
  characterIds: z.array(z.number().int().positive()).optional(),
  existingPlan: z
    .object({
      goal: z.string().optional(),
      conflict: z.string().optional(),
      turningPoint: z.string().optional(),
      beats: z.string().optional(),
      mustInclude: z.string().optional(),
      avoid: z.string().optional(),
      interestHooks: z.string().optional(),
      pacing: z.string().optional(),
      protocol: z.string().optional()
    })
    .optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = chapterPlanFieldSchema.parse(body)
  const em = useEm(event)
  const result = await generateChapterWorkflowPlanField({
    em,
    userId: auth.userId,
    novelId: data.novelId,
    chapterId: data.chapterId,
    chapterOutline: data.chapterOutline,
    field: data.field,
    characterIds: data.characterIds,
    existingPlan: data.existingPlan,
    aiConfigId: data.aiConfigId
  })

  return result
})

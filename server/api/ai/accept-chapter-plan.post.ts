import { z } from 'zod'
import { acceptChapterWorkflowPlan } from '../../services/chapter-workflow'

const acceptSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  planId: z.number().int().positive(),
  plan: z
    .object({
      goal: z.string(),
      conflict: z.string(),
      turningPoint: z.string(),
      beats: z.array(z.string()),
      mustInclude: z.array(z.string()),
      avoid: z.array(z.string()),
      characters: z.array(z.number().int().positive()),
      characterStateDeltas: z.array(z.string()),
      plotThreadActions: z.array(z.number().int().positive()),
      foreshadowingActions: z.array(z.number().int().positive()),
      interestHooks: z.array(z.string()),
      continuityRisks: z.array(z.string()),
      pacing: z.string(),
      protocol: z.string()
    })
    .optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = acceptSchema.parse(body)
  const em = useEm(event)

  const result = await acceptChapterWorkflowPlan({
    em,
    userId: auth.userId,
    novelId: data.novelId,
    chapterId: data.chapterId,
    planId: data.planId,
    editedPlan: data.plan
  })

  return {
    planId: result.workflowPlan.id,
    status: result.workflowPlan.status,
    acceptedAt: result.workflowPlan.acceptedAt,
    plan: result.plan
  }
})

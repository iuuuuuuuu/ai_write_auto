import { z } from 'zod'
import { createChapterWorkflowPlanDraft } from '../../services/chapter-workflow'

const saveChapterPlanSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  plan: z.object({
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
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = saveChapterPlanSchema.parse(body)
  const em = useEm(event)
  const result = await createChapterWorkflowPlanDraft({
    em,
    userId: auth.userId,
    novelId: data.novelId,
    chapterId: data.chapterId,
    plan: data.plan
  })

  return {
    planId: result.workflowPlan.id,
    status: result.workflowPlan.status,
    plan: result.plan,
    validation: result.validation
  }
})

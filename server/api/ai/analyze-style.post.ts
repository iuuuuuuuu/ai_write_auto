import { z } from 'zod'
import { callAi } from '../../utils/ai-client'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { NovelSchema, ChapterSchema } from '../../database/entities'

const styleSchema = z.object({
  novelId: z.number().int().positive(),
  aiConfigId: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = styleSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveUserAiConfig(em, auth.userId, 'style_analysis', data.aiConfigId)

  const chapters = await em.find(ChapterSchema, {
    novel: data.novelId,
    deletedAt: null,
  }, { orderBy: { chapterNumber: 'ASC' }, limit: 5 })

  const sampleText = chapters
    .filter((c) => c.content)
    .map((c) => c.content!.slice(0, 1500))
    .join('\n\n---\n\n')

  if (!sampleText) {
    throw createError({ statusCode: 400, message: 'No chapter content to analyze' })
  }

  const messages = [
    {
      role: 'system' as const,
      content: `你是一位文学风格分析师。请分析以下小说片段的写作风格，生成一份简洁的风格指南（200-400字），包含：
1. 叙事视角（第一人称/第三人称/全知等）
2. 句式特点（长句/短句/混合，是否多用修辞）
3. 用词风格（文学性/口语化/简洁/华丽）
4. 节奏感（快节奏/慢节奏/交替）
5. 对话风格（简短/冗长/方言/书面）
6. 描写偏好（重环境/重心理/重动作）

直接输出风格指南文本，不要标题或前缀。`,
    },
    {
      role: 'user' as const,
      content: sampleText,
    },
  ]

  const styleGuide = await callAi({
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.3,
    maxTokens: 1000,
  })

  await em.nativeUpdate(NovelSchema, { id: data.novelId }, { styleGuide, updatedAt: new Date() })

  return { styleGuide }
})

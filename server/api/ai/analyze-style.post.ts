import { z } from 'zod'
import { callAi } from '../../utils/ai-client'

const styleSchema = z.object({
  novelId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = styleSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  let aiConfig = await em.findOne('AiConfig', { user: auth.userId, purpose: 'style_analysis' })
  if (!aiConfig) {
    aiConfig = await em.findOne('AiConfig', { user: auth.userId, purpose: 'extraction' })
    if (!aiConfig) {
      throw createError({ statusCode: 400, message: 'No AI config found' })
    }
  }

  const chapters = await em.find('Chapter', {
    novel: data.novelId,
    deletedAt: null,
  }, { orderBy: { chapterNumber: 'ASC' }, limit: 5 })

  const sampleText = chapters
    .filter((c: any) => c.content)
    .map((c: any) => c.content!.slice(0, 1500))
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
    apiUrl: (aiConfig as any).apiUrl,
    apiKey: (aiConfig as any).apiKey,
    model: (aiConfig as any).model,
    messages,
    temperature: 0.3,
    maxTokens: 1000,
  })

  await em.nativeUpdate('Novel', { id: data.novelId }, { styleGuide, updatedAt: new Date() })

  return { styleGuide }
})

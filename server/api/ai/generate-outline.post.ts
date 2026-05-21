import { z } from 'zod'
import { callAi } from '../../utils/ai-client'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { NovelSchema } from '../../database/entities'

const outlineGenSchema = z.object({
  novelId: z.number().int().positive(),
  idea: z.string().min(1),
  chapterCount: z.number().int().min(3).max(200).default(20),
  startChapter: z.number().int().min(1).optional(),
  existingOutlines: z.array(z.object({
    chapterNumber: z.number().int().positive(),
    description: z.string()
  })).optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = outlineGenSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveUserAiConfig(em, auth.userId, 'generation', data.aiConfigId)

  const startChapter = data.startChapter || 1
  const existingContext = data.existingOutlines?.length ?
      `\n\n已有大纲（保留参考）：\n${data.existingOutlines
        .filter((item) => item.chapterNumber < startChapter)
        .map((item) => `第${item.chapterNumber}章：${item.description}`)
        .join('\n')}`
    : ''

  const messages = [
    {
      role: 'system' as const,
      content: `你是一位专业的小说策划师。请根据用户提供的故事核心想法，生成章节大纲。
从第 ${startChapter} 章开始，连续生成 ${data.chapterCount} 章。
每章用一句话描述核心内容。
返回 JSON 数组格式：[{"chapterNumber": ${startChapter}, "description": "..."}]
只返回 JSON，不要其他内容。`
    },
    {
      role: 'user' as const,
      content: `小说标题：${novel.title}\n类型：${novel.genre || '未指定'}\n故事核心想法：${data.idea}${existingContext}`
    }
  ]

  const result = await callAi({
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.8,
    maxTokens: 4000
  })

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    const outlines = JSON.parse(jsonMatch?.[0] || result)
    return { outlines }
  } catch {
    return { outlines: [], raw: result }
  }
})

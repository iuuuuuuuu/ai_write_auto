import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { callAi } from '../../utils/ai-client'
import { resolveUserAiConfig } from '../../utils/ai-configs'

const outlineGenSchema = z.object({
  novelId: z.number().int().positive(),
  idea: z.string().min(1),
  chapterCount: z.number().int().min(3).max(200).default(20),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = outlineGenSchema.parse(body)

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(
      and(
        eq(schema.novels.id, data.novelId),
        eq(schema.novels.userId, auth.userId)
      )
    )
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }
  const novel = novels[0]

  const aiConfig = await resolveUserAiConfig(
    db,
    auth.userId,
    'generation',
    data.aiConfigId
  )

  const messages = [
    {
      role: 'system' as const,
      content: `你是一位专业的小说策划师。请根据用户提供的故事核心想法，生成一个${data.chapterCount}章的章节大纲。
每章用一句话描述核心内容。
返回 JSON 数组格式：[{"chapterNumber": 1, "description": "..."}]
只返回 JSON，不要其他内容。`
    },
    {
      role: 'user' as const,
      content: `小说标题：${novel.title}\n类型：${novel.genre || '未指定'}\n故事核心想法：${data.idea}`
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

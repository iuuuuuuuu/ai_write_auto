import { z } from 'zod'
import { callAi } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { checkRateLimit } from '../../utils/rate-limit'
import { NovelSchema, ChapterSchema, CharacterSchema } from '../../database/entities'

const suggestSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const rateCheck = checkRateLimit(auth.userId)
  if (!rateCheck.allowed) {
    throw createError({
      statusCode: 429,
      message: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetIn / 1000)}s`
    })
  }

  const body = await readBody(event)
  const data = suggestSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const chapter = await em.findOne(ChapterSchema, { id: data.chapterId, novel: data.novelId })
  if (!chapter || !chapter.content) {
    throw createError({ statusCode: 400, message: 'Chapter has no content to review' })
  }

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'consistency_check', data.aiConfigId)
  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const charInfo = characters
    .slice(0, 10)
    .map((c) => `${c.name}: ${c.description || ''}`)
    .join('\n')

  const messages = [
    {
      role: 'system' as const,
      content: `你是一位专业的小说编辑。请审阅以下章节内容，找出可以改进的地方并提出具体修改建议。

## 审阅重点
- 表达不够生动或冗余的句子
- 对话不够自然的地方
- 描写可以更精炼或更有画面感的段落
- 节奏不当的地方（过快或过慢）
- 用词重复或不够精确的地方

## 返回格式
返回严格 JSON 数组，每条建议包含：
- originalText: 需要修改的原文片段（必须是章节中的精确原文，20-100字）
- suggestedText: 修改后的文本
- reason: 修改原因（简短，10-30字）

限制：最多返回 8 条建议，优先选择改进效果最明显的。
只返回 JSON 数组，不要其他内容。`
    },
    {
      role: 'user' as const,
      content: `${charInfo ? `## 角色档案\n${charInfo}\n\n` : ''}## 章节内容\n${chapter.content.slice(0, 10000)}`
    }
  ]

  const result = await callAi({
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.4,
    maxTokens: 4000
  })

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    const suggestions = JSON.parse(jsonMatch?.[0] || result)
    if (!Array.isArray(suggestions)) {
      return { suggestions: [] }
    }
    return {
      suggestions: suggestions
        .filter((s: any) => s.originalText && s.suggestedText)
        .map((s: any) => ({
          originalText: String(s.originalText),
          suggestedText: String(s.suggestedText),
          reason: String(s.reason || '')
        }))
    }
  } catch {
    return { suggestions: [], raw: result }
  }
})

import { z } from 'zod'
import { callAi } from '../../utils/ai-client'
import { AiConfigSchema, ChapterSchema, CharacterSchema } from '../../database/entities'

const checkSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = checkSchema.parse(body)
  const em = useEm(event)

  const resolved = await (async () => {
    const config = await em.findOne(AiConfigSchema, { user: auth.userId, purpose: 'consistency_check', enabled: true }, { populate: ['aiModel'] })
      || await em.findOne(AiConfigSchema, { user: auth.userId, purpose: 'extraction', enabled: true }, { populate: ['aiModel'] })
    if (!config || !config.aiModel) {
      throw createError({ statusCode: 400, message: '未找到一致性检查或信息提取的 AI 配置' })
    }
    const m = config.aiModel as any
    if (!m.enabled) throw createError({ statusCode: 400, message: `模型「${m.name}」已被禁用` })
    return { apiUrl: m.apiUrl, apiKey: m.apiKey, model: m.model, maxTokens: m.maxTokens, temperature: config.temperature }
  })()

  const chapters = await em.find(ChapterSchema, {
    novel: data.novelId,
    deletedAt: null,
  }, { orderBy: { chapterNumber: 'ASC' } })

  const targetChapter = chapters.find((c) => c.id === data.chapterId)
  if (!targetChapter) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }

  const characters = await em.find(CharacterSchema, { novel: data.novelId })

  const charInfo = characters.map((c) => `${c.name}: ${c.description || ''} (${c.traits || ''})`).join('\n')
  const recentSummaries = chapters
    .filter((c) => c.chapterNumber < targetChapter.chapterNumber && c.summary)
    .slice(-5)
    .map((c) => `第${c.chapterNumber}章: ${c.summary}`)
    .join('\n')

  const messages = [
    {
      role: 'system' as const,
      content: `你是一位专业的小说编辑。请检查以下章节内容是否存在一致性问题。
检查项目：
1. 角色名字是否前后一致
2. 时间线是否有矛盾
3. 已死亡/离开的角色是否意外出现
4. 地点描述是否前后矛盾
5. 角色性格是否突然改变（无合理原因）

以 JSON 数组格式返回发现的问题：[{"type": "角色一致性|时间线|地点|性格", "severity": "high|medium|low", "description": "问题描述"}]
如果没有发现问题，返回空数组 []。只返回 JSON。`,
    },
    {
      role: 'user' as const,
      content: `角色档案：\n${charInfo}\n\n前情摘要：\n${recentSummaries}\n\n当前章节（第${targetChapter.chapterNumber}章）：\n${targetChapter.content || ''}`,
    },
  ]

  const result = await callAi({
    apiUrl: resolved.apiUrl,
    apiKey: resolved.apiKey,
    model: resolved.model,
    messages,
    temperature: 0.2,
    maxTokens: 2000,
  })

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    const issues = JSON.parse(jsonMatch?.[0] || result)
    return { issues }
  } catch {
    return { issues: [], raw: result }
  }
})

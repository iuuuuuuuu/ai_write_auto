import type { EntityManager } from '@mikro-orm/core'
import { callAi } from './ai-client'
import { AiConfigSchema, ChapterSchema, CharacterSchema, ConsistencyIssueSchema } from '../database/entities'

export async function runConsistencyCheck(
  em: EntityManager,
  userId: number,
  novelId: number,
  chapterId: number
): Promise<Array<{ type: string; severity: string; description: string }>> {
  let aiConfig = await em.findOne(AiConfigSchema, { user: userId, purpose: 'consistency_check', enabled: true })
  if (!aiConfig) {
    aiConfig = await em.findOne(AiConfigSchema, { user: userId, purpose: 'extraction', enabled: true })
  }
  if (!aiConfig) return []

  const chapters = await em.find(ChapterSchema, {
    novel: novelId,
    deletedAt: null,
  }, { orderBy: { chapterNumber: 'ASC' } })

  const targetChapter = chapters.find((c) => c.id === chapterId)
  if (!targetChapter || !targetChapter.content) return []

  const characters = await em.find(CharacterSchema, { novel: novelId })

  const charInfo = characters
    .map((c) => `${c.name}: ${c.description || ''} (${c.traits || ''})`)
    .join('\n')

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
      content: `角色档案：\n${charInfo}\n\n前情摘要：\n${recentSummaries}\n\n当前章节（第${targetChapter.chapterNumber}章）：\n${targetChapter.content.slice(0, 8000)}`,
    },
  ]

  const result = await callAi({
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.2,
    maxTokens: 2000,
  })

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    const issues: Array<{ type: string; severity: string; description: string }> = JSON.parse(jsonMatch?.[0] || result)

    if (Array.isArray(issues) && issues.length > 0) {
      await em.nativeDelete(ConsistencyIssueSchema, { chapter: chapterId })

      for (const issue of issues) {
        em.create(ConsistencyIssueSchema, {
          chapter: chapterId,
          type: issue.type || 'unknown',
          severity: (issue.severity as any) || 'medium',
          description: issue.description || ''
        })
      }
      await em.flush()
    }

    return issues
  } catch {
    return []
  }
}

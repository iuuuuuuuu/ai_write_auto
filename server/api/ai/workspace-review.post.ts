import { z } from 'zod'
import { streamAi, toAiOptions } from '../../utils/ai-client'
import { recordUsage } from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { REVIEW_MAX_CHAPTERS } from '../../utils/ai-constants'
import { NovelSchema, ChapterSchema, CharacterSchema, PlotPointSchema, ConsistencyIssueSchema } from '../../database/entities'

const reviewSchema = z.object({
  novelId: z.number().int().positive(),
  chapterIds: z.array(z.number().int().positive()).min(1).max(REVIEW_MAX_CHAPTERS),
  autoFix: z.boolean().optional().default(false),
  aiConfigId: z.number().int().positive().optional()
})

interface ReviewIssue {
  chapterId: number
  chapterNumber: number
  type: 'plot_hole' | 'character_inconsistency' | 'pacing' | 'foreshadowing_dangling' | 'repetition' | 'style_deviation' | 'factual_error'
  severity: 'high' | 'medium' | 'low'
  description: string
  suggestion: string
  autoFixable: boolean
  originalText?: string
  fixedText?: string
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = reviewSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'consistency_check', data.aiConfigId)
    || await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)
  if (!aiConfig) throw createError({ statusCode: 400, message: 'No AI config available' })

  // Load chapters in order
  const chapters = await em.find(ChapterSchema, {
    id: { $in: data.chapterIds },
    novel: data.novelId,
    deletedAt: null
  }, { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] })

  if (!chapters.length) throw createError({ statusCode: 404, message: 'No chapters found' })

  const characters = await em.find(CharacterSchema, { novel: data.novelId })
  const plotPoints = await em.find(PlotPointSchema, { novel: data.novelId })

  // Build character summary for review context
  const characterSummary = characters.map(c => {
    let info = `${c.name}`
    if (c.description) info += `：${c.description}`
    if (c.traits) info += `（性格：${c.traits}）`
    if (c.relationships) info += `【关系：${c.relationships}】`
    if (c.currentState) info += `「当前：${c.currentState}」`
    return info
  }).join('\n')

  // Build chapter content for review
  const chapterContents = chapters.map(c => ({
    id: c.id,
    number: c.chapterNumber,
    title: c.title,
    content: (c.content || '').slice(0, 6000),
    summary: c.summary || ''
  }))

  const reviewPrompt = `你是一位资深小说编辑。请审阅以下多个章节，找出所有问题并给出修改建议。

## 审查维度
1. **情节漏洞**：前后矛盾、逻辑不通、因果缺失
2. **角色不一致**：性格突变、行为与设定矛盾、对话风格不统一
3. **节奏问题**：拖沓、过快、张弛失当
4. **伏笔问题**：已铺设但未回收的伏笔、回收不自然
5. **重复内容**：重复描写、重复对话、重复情节模式
6. **风格偏离**：与整体风格指南不一致
7. **事实错误**：时间线矛盾、地理错误、设定冲突

## 角色档案
${characterSummary}

${plotPoints.length ? '## 情节点\n' + plotPoints.map(p => `- [${p.type}/${p.status}] ${p.description}`).join('\n') : ''}

${novel.styleGuide ? `## 风格指南\n${novel.styleGuide}\n` : ''}

## 待审阅章节
${chapterContents.map(c => `### 第${c.number}章《${c.title}》\n${c.content}\n`).join('\n---\n')}

## 输出要求
返回 JSON 数组，每个元素格式：
{
  "chapterId": 章节ID,
  "chapterNumber": 章节号,
  "type": "plot_hole|character_inconsistency|pacing|foreshadowing_dangling|repetition|style_deviation|factual_error",
  "severity": "high|medium|low",
  "description": "问题描述",
  "suggestion": "修改建议",
  "autoFixable": true/false,
  "originalText": "原文片段（如有）",
  "fixedText": "修改后文本（如有）"
}

只返回 JSON 数组，不要其他内容。如果没有问题，返回空数组 []。`

  const messages = [
    { role: 'system' as const, content: '你是资深小说编辑，擅长发现情节漏洞、角色不一致和风格问题。请仔细审阅并返回精确的 JSON 格式审查结果。' },
    { role: 'user' as const, content: reviewPrompt }
  ]

  let reviewContent = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(toAiOptions(aiConfig, {
    messages,
    temperature: 0.2,
    maxTokens: 4096
  }))) {
    if (chunk.content) reviewContent += chunk.content
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
  }

  await recordUsage({ em, userId: auth.userId, configId: aiConfig.configId, model: aiConfig.model }, inputTokens, outputTokens)

  let issues: ReviewIssue[] = []
  try {
    const jsonMatch = reviewContent.match(/\[[\s\S]*\]/)
    issues = JSON.parse(jsonMatch?.[0] || reviewContent)
  } catch {
    // If JSON parsing fails, return raw result
    return {
      success: true,
      issues: [],
      rawResult: reviewContent,
      chaptersReviewed: chapters.length
    }
  }

  // Save issues to database
  for (const issue of issues) {
    em.create(ConsistencyIssueSchema, {
      chapter: issue.chapterId,
      type: issue.type,
      severity: issue.severity,
      description: `[审阅] ${issue.description}\n建议：${issue.suggestion}`
    })
  }
  await em.flush()

  // Auto-fix if requested
  let fixedChapters: Array<{ chapterId: number; chapterNumber: number; fixedContent: string }> = []
  if (data.autoFix) {
    const fixableIssues = issues.filter(i => i.autoFixable && i.originalText && i.fixedText)
    const groupedByChapter = new Map<number, ReviewIssue[]>()
    for (const issue of fixableIssues) {
      const list = groupedByChapter.get(issue.chapterId) || []
      list.push(issue)
      groupedByChapter.set(issue.chapterId, list)
    }

    for (const [chapterId, chapterIssues] of groupedByChapter) {
      const chapter = chapters.find(c => c.id === chapterId)
      if (!chapter?.content) continue

      const fixPrompt = `你是一位小说编辑。请根据以下修改建议，修正章节内容中的问题。只修正指出的问题，保持其余内容不变。直接返回修正后的完整章节内容。

## 章节内容
${chapter.content.slice(0, 8000)}

## 需要修正的问题
${chapterIssues.map(i => `- 问题：${i.description}\n  原文：${i.originalText}\n  修改为：${i.fixedText}`).join('\n')}

请返回修正后的完整章节内容，不要包含任何说明。`

      const fixMessages = [
        { role: 'system' as const, content: '你是小说编辑。根据修改建议修正文本，只改需要改的地方。' },
        { role: 'user' as const, content: fixPrompt }
      ]

      let fixContent = ''
      let fixInputTokens = 0
      let fixOutputTokens = 0
      for await (const chunk of streamAi(toAiOptions(aiConfig, {
        messages: fixMessages,
        temperature: 0.3,
        maxTokens: 8192
      }))) {
        if (chunk.content) fixContent += chunk.content
        if (chunk.usage) {
          fixInputTokens = chunk.usage.prompt_tokens || fixInputTokens
          fixOutputTokens = chunk.usage.completion_tokens || fixOutputTokens
        }
      }
      await recordUsage({ em, userId: auth.userId, configId: aiConfig.configId, model: aiConfig.model }, fixInputTokens, fixOutputTokens)

      if (fixContent && fixContent.length > 100) {
        fixedChapters.push({
          chapterId,
          chapterNumber: chapter.chapterNumber,
          fixedContent: fixContent
        })
      }
    }
  }

  return {
    success: true,
    issues,
    chaptersReviewed: chapters.length,
    issuesFound: issues.length,
    highSeverity: issues.filter(i => i.severity === 'high').length,
    mediumSeverity: issues.filter(i => i.severity === 'medium').length,
    lowSeverity: issues.filter(i => i.severity === 'low').length,
    autoFixed: fixedChapters.length > 0,
    fixedChapters
  }
})

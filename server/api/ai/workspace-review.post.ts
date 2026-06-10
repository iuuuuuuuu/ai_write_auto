import { z } from 'zod'
import { streamAi, toAiOptions } from '../../utils/ai-client'
import { recordUsage, createRequestSignal } from '../../utils/ai-stream'
import {
  resolveNovelAiConfig,
  type ResolvedAiConfig
} from '../../utils/ai-configs'
import {
  REVIEW_MAX_CHAPTERS,
  MAX_TOKENS_REVIEW
} from '../../utils/ai-constants'
import {
  NovelSchema,
  ChapterSchema,
  CharacterSchema,
  PlotPointSchema,
  ConsistencyIssueSchema
} from '../../database/entities'
import { filterUsablePlotPoints } from '../../utils/plot-points'

const reviewSchema = z.object({
  novelId: z.number().int().positive(),
  chapterIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(REVIEW_MAX_CHAPTERS),
  aiConfigId: z.number().int().positive().optional()
})

type IssueType =
  | 'plot_hole'
  | 'character_inconsistency'
  | 'pacing'
  | 'foreshadowing_dangling'
  | 'repetition'
  | 'style_deviation'
  | 'factual_error'

interface ReviewIssue {
  chapterId: number
  chapterNumber: number
  type: IssueType
  severity: 'high' | 'medium' | 'low'
  description: string
  suggestion: string
  // 保留供前端「采用建议」做精确替换；不再用于整章自动重写
  originalText?: string
  fixedText?: string
}

const cleanJson = (s: string) =>
  s.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim()

/** 三级容错解析单章审核结果：贪婪数组 → 惰性数组 → 对象包装字段。 */
function parseIssues(raw: string): {
  issues: ReviewIssue[]
  parseError?: string
} {
  let issues: ReviewIssue[] = []
  let parseError: string | undefined
  try {
    const cleaned = cleanJson(raw)
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      try {
        issues = JSON.parse(arrMatch[0])
      } catch {
        const lazyMatch = cleaned.match(/\[[\s\S]*?\]/)
        if (lazyMatch) issues = JSON.parse(lazyMatch[0])
      }
    }
    if (!Array.isArray(issues) || !issues.length) {
      try {
        const obj = JSON.parse(cleaned)
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const key of [
            'issues',
            'results',
            'problems',
            'items',
            'data'
          ]) {
            if (Array.isArray((obj as any)[key])) {
              issues = (obj as any)[key]
              break
            }
          }
        }
      } catch {
        /* 继续 */
      }
    }
  } catch (e: any) {
    parseError = `JSON 解析失败: ${e.message}`
  }

  if (!Array.isArray(issues)) {
    issues = []
    parseError = parseError || 'AI 返回结果非数组'
  }
  const beforeFilter = issues.length
  issues = issues.filter(
    (i) =>
      i &&
      typeof i.type === 'string' &&
      i.type.length > 0 &&
      (typeof i.description === 'string' || typeof i.suggestion === 'string')
  )
  if (beforeFilter > 0 && issues.length === 0) {
    parseError = parseError || '返回结果中缺少必要字段（type/description）'
  }
  return { issues, parseError }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = reviewSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  // 优先用 consistency_check 用途的配置；未配置则回退到 generation。
  // 注意 resolveNovelAiConfig 找不到会抛错（而非返回 null），故用 try/catch 实现真正的回退。
  let aiConfig: ResolvedAiConfig
  try {
    aiConfig = await resolveNovelAiConfig(
      em,
      auth.userId,
      data.novelId,
      'consistency_check',
      data.aiConfigId
    )
  } catch {
    aiConfig = await resolveNovelAiConfig(
      em,
      auth.userId,
      data.novelId,
      'generation',
      data.aiConfigId
    )
  }

  // 按章号升序加载，逐章顺序审核
  const chapters = await em.find(
    ChapterSchema,
    { id: { $in: data.chapterIds }, novel: data.novelId, deletedAt: null },
    { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] }
  )
  if (!chapters.length)
    throw createError({ statusCode: 404, message: 'No chapters found' })

  const characters = await em.find(CharacterSchema, { novel: data.novelId })
  const allPlotPoints = await em.find(
    PlotPointSchema,
    { novel: data.novelId },
    { populate: ['chapter'] }
  )
  const plotPoints = filterUsablePlotPoints(allPlotPoints)

  const characterSummary = characters
    .map((c) => {
      let info = `${c.name}`
      if (c.description) info += `：${c.description}`
      if (c.traits) info += `（性格：${c.traits}）`
      if (c.relationships) info += `【关系：${c.relationships}】`
      if (c.currentState) info += `「当前：${c.currentState}」`
      return info
    })
    .join('\n')
  const plotContext =
    plotPoints.length ?
      '## 情节点\n' +
      plotPoints
        .map((p) => `- [${p.type}/${p.status}] ${p.description}`)
        .join('\n') +
      '\n'
    : ''
  const styleContext =
    novel.styleGuide ? `## 风格指南\n${novel.styleGuide}\n` : ''

  const signal = createRequestSignal(event)
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        )

      controller.enqueue(encoder.encode(': connected\n\n'))

      let totalHigh = 0
      let totalMedium = 0
      let totalLow = 0
      let totalIssues = 0
      let reviewedCount = 0
      // 已审章节摘要——逐章独审会丢失跨章一致性，用前文摘要补偿
      const reviewedSummaries: Array<{
        number: number
        title: string
        summary: string
      }> = []

      try {
        for (const [i, chapter] of chapters.entries()) {
          if (signal.aborted) {
            send({ type: 'cancelled' })
            return
          }

          send({
            type: 'progress',
            current: chapter.chapterNumber,
            title: chapter.title,
            completed: i,
            total: chapters.length
          })

          const prevContext =
            reviewedSummaries.length ?
              `## 前文已审章节摘要（仅作跨章一致性参考，不要重复报告这些章节的问题）\n${reviewedSummaries
                .map((s) => `第${s.number}章《${s.title}》：${s.summary}`)
                .join('\n')}\n`
            : ''

          const reviewPrompt = `你是一位资深小说编辑。请仔细审阅下面这一章，找出所有问题并给出修改建议。

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

${plotContext}${styleContext}${prevContext}
## 待审阅章节
### 第${chapter.chapterNumber}章《${chapter.title}》
${(chapter.content || '').slice(0, 6000)}

## 输出要求
返回 JSON 数组，每个元素格式：
{
  "type": "plot_hole|character_inconsistency|pacing|foreshadowing_dangling|repetition|style_deviation|factual_error",
  "severity": "high|medium|low",
  "description": "问题描述",
  "suggestion": "修改建议",
  "originalText": "原文片段（如可定位，便于精确修正）",
  "fixedText": "修改后文本（如有）"
}
本次只审这一章，无需返回章节号。只返回 JSON 数组，不要其他内容。如果没有问题，返回空数组 []。`

          const messages = [
            {
              role: 'system' as const,
              content:
                '你是资深小说编辑，擅长发现情节漏洞、角色不一致和风格问题。请仔细审阅并返回精确的 JSON 格式审查结果。'
            },
            { role: 'user' as const, content: reviewPrompt }
          ]

          let reviewContent = ''
          let inputTokens = 0
          let outputTokens = 0
          for await (const chunk of streamAi(
            toAiOptions(aiConfig, {
              messages,
              temperature: 0.2,
              maxTokens: MAX_TOKENS_REVIEW,
              signal
            })
          )) {
            if (chunk.content) reviewContent += chunk.content
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || inputTokens
              outputTokens = chunk.usage.completion_tokens || outputTokens
            }
          }
          await recordUsage(
            {
              em,
              userId: auth.userId,
              configId: aiConfig.id,
              model: aiConfig.model
            },
            inputTokens,
            outputTokens
          )

          const { issues, parseError } = parseIssues(reviewContent)
          // 单章场景：章节归属由后端强制为当前章，severity 兜底为 medium
          const normalized: ReviewIssue[] = issues.map((it) => ({
            chapterId: chapter.id,
            chapterNumber: chapter.chapterNumber,
            type: it.type,
            severity:
              ['high', 'medium', 'low'].includes(it.severity) ?
                it.severity
              : 'medium',
            description:
              typeof it.description === 'string' ? it.description : '',
            suggestion: typeof it.suggestion === 'string' ? it.suggestion : '',
            originalText: it.originalText,
            fixedText: it.fixedText
          }))

          // 落库该章问题
          for (const it of normalized) {
            em.create(ConsistencyIssueSchema, {
              chapter: chapter.id,
              type: it.type,
              severity: it.severity,
              description: `[审阅] ${it.description}${it.suggestion ? `\n建议：${it.suggestion}` : ''}`
            })
          }
          await em.flush()

          const high = normalized.filter((i) => i.severity === 'high').length
          const medium = normalized.filter(
            (i) => i.severity === 'medium'
          ).length
          const low = normalized.filter((i) => i.severity === 'low').length
          totalHigh += high
          totalMedium += medium
          totalLow += low
          totalIssues += normalized.length
          reviewedCount++

          send({
            type: 'chapter_reviewed',
            chapterId: chapter.id,
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            issues: normalized,
            high,
            medium,
            low,
            parseError
          })

          // 严重度软停止：本章出现 high 级问题 → 暂停，剩余章节留待用户决定是否「继续审剩余」
          if (high > 0) {
            send({
              type: 'stopped',
              atChapterNumber: chapter.chapterNumber,
              atChapterId: chapter.id,
              pendingChapterIds: chapters.slice(i + 1).map((c) => c.id),
              reviewedCount,
              totalIssues,
              high: totalHigh,
              medium: totalMedium,
              low: totalLow
            })
            return
          }

          // 收集本章摘要供后续章节做跨章参考
          reviewedSummaries.push({
            number: chapter.chapterNumber,
            title: chapter.title,
            summary: chapter.summary || (chapter.content || '').slice(0, 200)
          })
        }

        send({
          type: 'done',
          reviewedCount,
          totalIssues,
          high: totalHigh,
          medium: totalMedium,
          low: totalLow
        })
      } catch (e: any) {
        try {
          send({ type: 'error', message: e?.message || '审核失败' })
        } catch {
          /* ignore */
        }
      } finally {
        try {
          controller.close()
        } catch {
          /* ignore */
        }
      }
    }
  })

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })

  return new Response(stream)
})

import { z } from 'zod'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { NovelSchema } from '../../database/entities'
import {
  getCharacterStateChangeKey,
  getRagContextKey,
  prepareChapterContext
} from '../../services/chapter-context'
import { resolveChapterGenerationInputs } from '../../services/generation-context'
import { isEmbeddingReady } from '../../services/embedding'

const contextSelectionSchema = z
  .object({
    includedKeys: z.array(z.string()).optional(),
    excludedKeys: z.array(z.string()).optional()
  })
  .optional()

const previewSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  direction: z.string().optional(),
  chapterOutline: z.string().optional(),
  aiConfigId: z.number().int().positive().optional(),
  skillIds: z.array(z.number().int().positive()).optional(),
  contextSelection: contextSelectionSchema
})

function estimateTokens(value: string | null | undefined): number {
  return Math.ceil((value || '').length / 2)
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = previewSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )

  const contextInputs = await resolveChapterGenerationInputs({
    em,
    novel,
    novelId: data.novelId,
    userId: auth.userId,
    chapterId: data.chapterId,
    chapterOutline: data.chapterOutline,
    direction: data.direction,
    aiConfig,
    requestSkillIds: data.skillIds
  })

  const prepared = await prepareChapterContext(em, {
    novel,
    novelId: data.novelId,
    userId: auth.userId,
    currentChapter:
      contextInputs.currentChapter ?
        {
          title: contextInputs.currentChapter.title,
          chapterNumber: contextInputs.currentChapter.chapterNumber
        }
      : undefined,
    outline: contextInputs.chapterOutline,
    direction: data.direction,
    precedingChapters: contextInputs.precedingChapters,
    characters: contextInputs.characters,
    plotPoints: contextInputs.plotPoints,
    storyArcs: contextInputs.storyArcs,
    foreshadowing: contextInputs.foreshadowing,
    recentChapterContent: contextInputs.recentChapterContent,
    depth: 'query-only',
    skillIds: contextInputs.skillIds,
    contextSelection: data.contextSelection
  })

  const warnings: Array<{ type: string; message: string }> = []
  if (!isEmbeddingReady()) {
    warnings.push({
      type: 'embedding_unavailable',
      message: '向量检索未就绪，本次预览不会包含检索记忆。'
    })
  }
  if (!contextInputs.chapterOutline) {
    warnings.push({
      type: 'missing_outline',
      message: '本章大纲为空，生成会主要依赖写作方向和前文。'
    })
  }

  const ragItems = prepared.retrievedNotes.map((item) => ({
    key: getRagContextKey(item),
    type: 'rag',
    title: item.characterName || `[${item.contentType}]`,
    summary: item.content.slice(0, 120),
    content: item.content,
    required: false,
    selectedByDefault: true,
    tokenEstimate: estimateTokens(item.content),
    meta: {
      contentType: item.contentType,
      chapterId: item.chapterId,
      characterName: item.characterName,
      score: item.score
    }
  }))

  const stateChangeItems = prepared.characterStateChanges.map((change) => ({
    key: getCharacterStateChangeKey(change),
    type: 'character-state-change',
    title: `${change.characterName} · ${change.changeType}`,
    summary: change.afterValue,
    content:
      change.evidenceQuote ?
        `${change.afterValue}\n证据：${change.evidenceQuote}`
      : change.afterValue,
    required: false,
    selectedByDefault: true,
    tokenEstimate: estimateTokens(
      `${change.afterValue}${change.evidenceQuote || ''}`
    ),
    meta: {
      chapterNumber: change.chapterNumber,
      characterName: change.characterName,
      relatedCharacterName: change.relatedCharacterName,
      changeType: change.changeType
    }
  }))

  const recentChapterItems = contextInputs.recentChapterContent.map(
    (chapter) => ({
      key: `recent-chapter:${chapter.chapterNumber}`,
      type: 'recent-chapter',
      title: `第${chapter.chapterNumber}章「${chapter.title}」`,
      summary: chapter.content.slice(0, 120),
      content: chapter.content,
      required: false,
      selectedByDefault: true,
      tokenEstimate: estimateTokens(chapter.content),
      meta: { chapterNumber: chapter.chapterNumber }
    })
  )

  const requiredItems = [
    {
      key: 'required:novel',
      type: 'required',
      title: '小说基础信息',
      summary: novel.title,
      content: [novel.title, novel.genre, novel.description, novel.worldSetting]
        .filter(Boolean)
        .join('\n'),
      required: true,
      selectedByDefault: true,
      tokenEstimate: estimateTokens(
        [novel.title, novel.genre, novel.description, novel.worldSetting]
          .filter(Boolean)
          .join('\n')
      ),
      meta: {}
    },
    {
      key: 'required:chapter-plan',
      type: 'required',
      title: '本章大纲与方向',
      summary: contextInputs.chapterOutline || data.direction || '未填写',
      content: [contextInputs.chapterOutline, data.direction]
        .filter(Boolean)
        .join('\n'),
      required: true,
      selectedByDefault: true,
      tokenEstimate: estimateTokens(
        [contextInputs.chapterOutline, data.direction]
          .filter(Boolean)
          .join('\n')
      ),
      meta: {}
    }
  ]

  const selectedKeys = [
    ...requiredItems.map((item) => item.key),
    ...ragItems.map((item) => item.key),
    ...stateChangeItems.map((item) => item.key),
    ...recentChapterItems.map((item) => item.key)
  ]

  return {
    sections: [
      { key: 'required', title: '基础上下文', items: requiredItems },
      {
        key: 'character-state',
        title: '已确认角色变化',
        items: stateChangeItems
      },
      { key: 'rag', title: '检索记忆', items: ragItems },
      {
        key: 'recent-chapters',
        title: '最近章节全文',
        items: recentChapterItems
      }
    ],
    warnings,
    selection: { includedKeys: selectedKeys, excludedKeys: [] },
    usage: prepared.usage,
    promptPreview: prepared.messages.map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1200)
    }))
  }
})

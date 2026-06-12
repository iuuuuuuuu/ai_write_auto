<script setup lang="ts">
definePageMeta({
  layout: 'default',
  pageTransition: false,
  contentOverflow: 'hidden'
})

import { h } from 'vue'
import { Icon } from '@iconify/vue'
import GenerationContextPreview from '../../../../components/novel/GenerationContextPreview.vue'
import { computeLineDiff, type DiffLine } from '../../../../utils/diff'
import { consumeSSEStream } from '../../../../utils/sse-stream'
import {
  cleanAiChapterTitle,
  formatAiTitleUsage,
  stripChapterNumberPrefix,
  type AiTitleUsage
} from '../../../../utils/chapter-title'
import type { DraftRecoveryType } from '../../../../composables/useDraftRecovery'
import type { GenerationContextSelection } from '../../../../composables/useGenerationContextSelection'

const { t } = useI18n()
const route = useRoute()
const message = useMessage()
const dialog = useDialog()
const { put: apiPut, post: apiPost } = useApi()
const novelId = computed(() => Number(route.params.id))
const chapterId = computed(() => Number(route.params.chapterId))
const { updateActiveTabTitle } = useTabs('user')

function getNovelTo() {
  return {
    path: `/novels/${novelId.value}`
  }
}

/* ─────────────── 左侧边栏状态 ─────────────── */
const leftSidebarTab = ref<
  'chapters' | 'characters' | 'versions' | 'notes' | 'checks'
>('chapters')
const sidebarCollapsed = ref(false)

/* ─────────────── 版本管理 ─────────────── */
type ChapterVersionItem = {
  id: number
  versionNumber: number
  content: string
  source: 'ai_generated' | 'user_edited'
  createdAt: string
}

const { data: versions, refresh: refreshVersions } = await useFetch<
  ChapterVersionItem[]
>(() => `/api/novels/${novelId.value}/chapters/${chapterId.value}/versions`, {
  default: () => []
})

const showVersionDiff = ref(false)
const diffVersion = ref<ChapterVersionItem | null>(null)
const diffLines = ref<DiffLine[]>([])
const rollingBack = ref(false)
const undoingVersionId = ref<number | null>(null)

/* ─────────────── 作者笔记 ─────────────── */
const { data: chapterNote, refresh: refreshChapterNote } = await useFetch<{
  id: number | null
  content: string
  createdAt: string | null
  updatedAt: string | null
}>(() => `/api/novels/${novelId.value}/chapters/${chapterId.value}/notes`, {
  default: () => ({ id: null, content: '', createdAt: null, updatedAt: null })
})

const noteContent = ref('')
const savingNote = ref(false)
const noteDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

watch(
  () => chapterNote.value,
  (note) => {
    if (note) noteContent.value = note.content || ''
  },
  { immediate: true }
)

async function saveNote() {
  if (savingNote.value) return
  savingNote.value = true
  try {
    await apiPut(
      `/api/novels/${novelId.value}/chapters/${chapterId.value}/notes`,
      { content: noteContent.value }
    )
    await refreshChapterNote()
  } catch {
    // error toast handled by useApi
  } finally {
    savingNote.value = false
  }
}

function onNoteInput() {
  if (noteDebounceTimer.value) clearTimeout(noteDebounceTimer.value)
  noteDebounceTimer.value = setTimeout(saveNote, 1500)
}

/* ─────────────── 章节列表 ─────────────── */
type ChapterListItem = {
  id: number
  chapterNumber: number
  title: string
  status: string
  wordCount: number | null
}

const { data: allChapters, refresh: refreshAllChapters } = await useFetch<
  Array<ChapterListItem>
>(`/api/novels/${novelId.value}/chapters`)

const chapterSearchQuery = ref('')
const chapterListRef = ref<HTMLElement | null>(null)
const chapterButtonRefs = new Map<number, HTMLElement>()

const chapterIndex = computed(() => {
  if (!allChapters.value) return -1
  return allChapters.value.findIndex((c) => c.id === chapterId.value)
})
const filteredChapters = computed(() => {
  const chapters = allChapters.value || []
  const query = normalizeSearchText(chapterSearchQuery.value)
  if (!query) return chapters

  return chapters.filter((chapterItem) => {
    const searchable = normalizeSearchText(
      `${chapterItem.chapterNumber} ${chapterItem.title} ${chapterItem.status}`
    )
    return searchable.includes(query)
  })
})
const prevChapter = computed(() => {
  const idx = chapterIndex.value
  return idx > 0 ? allChapters.value![idx - 1] : null
})
const nextChapter = computed(() => {
  const idx = chapterIndex.value
  return allChapters.value && idx < allChapters.value.length - 1 ?
      allChapters.value[idx + 1]
    : null
})
function goToChapter(cid: number) {
  navigateTo(`/novels/${novelId.value}/chapters/${cid}`)
  nextTick(() => setTimeout(scrollCurrentChapterIntoView, 100))
}

function openChapterInNewTab(cid: number) {
  const path = `/novels/${novelId.value}/chapters/${cid}`
  const { addTab } = useTabs('user')
  addTab(path, { title: '章节编辑' })
}

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase()
}

function setChapterButtonRef(id: number, el: unknown) {
  if (el instanceof HTMLElement) {
    chapterButtonRefs.set(id, el)
    return
  }
  chapterButtonRefs.delete(id)
}

async function scrollCurrentChapterIntoView() {
  if (sidebarCollapsed.value || leftSidebarTab.value !== 'chapters') return
  await nextTick()
  const currentButton = chapterButtonRefs.get(chapterId.value)
  currentButton?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function locateCurrentChapter() {
  sidebarCollapsed.value = false
  leftSidebarTab.value = 'chapters'
  const currentVisible = filteredChapters.value.some(
    (chapterItem) => chapterItem.id === chapterId.value
  )
  if (!currentVisible) chapterSearchQuery.value = ''
  scrollCurrentChapterIntoView()
}

const creatingChapter = ref(false)
const showNewChapterDialog = ref(false)
const newChapterTitle = ref('')
const newChapterPosition = ref<'end' | 'before' | 'after'>('end')
const newChapterRefId = ref<number | null>(null)
const generatingTitle = ref(false)
const suggestedNewChapterTitle = ref('')
const newTitleSuggestionUsage = ref<AiTitleUsage | null>(null)

const chapterPositionOptions = [
  { label: '添加到末尾', value: 'end' },
  { label: '插入到指定章节之前', value: 'before' },
  { label: '插入到指定章节之后', value: 'after' }
]
const chapterRefOptions = computed(() =>
  (allChapters.value || []).map((c, i) => ({
    label: `第${i + 1}章 ${stripChapterNumberPrefix(c.title) || '未命名'}`,
    value: c.id
  }))
)

function openNewChapterDialog() {
  newChapterTitle.value = ''
  newChapterPosition.value = 'end'
  newChapterRefId.value =
    allChapters.value?.length ?
      allChapters.value[allChapters.value.length - 1]!.id
    : null
  suggestedNewChapterTitle.value = ''
  newTitleSuggestionUsage.value = null
  showNewChapterDialog.value = true
}

async function aiGenerateNewTitle() {
  if (generatingTitle.value) return
  generatingTitle.value = true
  suggestedNewChapterTitle.value = ''
  newTitleSuggestionUsage.value = null
  try {
    const nextNum = (allChapters.value?.length || 0) + 1
    const lastChapter = allChapters.value?.[allChapters.value.length - 1]
    const result = await $fetch<{ title: string; usage?: AiTitleUsage }>(
      '/api/ai/suggest-title',
      {
        method: 'POST',
        body: {
          novelId: novelId.value,
          chapterNumber: nextNum,
          previousChapterTitle: lastChapter?.title || undefined,
          aiConfigId: selectedAiConfigId.value
        }
      }
    )
    const cleaned = cleanAiChapterTitle(result.title)
    if (cleaned) {
      suggestedNewChapterTitle.value = cleaned
      newTitleSuggestionUsage.value = result.usage || null
    } else {
      message.warning('AI 未能生成有效标题')
    }
  } catch {
    message.error('生成章节名失败')
  } finally {
    generatingTitle.value = false
  }
}

function applySuggestedNewChapterTitle() {
  if (!suggestedNewChapterTitle.value) return
  newChapterTitle.value = suggestedNewChapterTitle.value
  suggestedNewChapterTitle.value = ''
  newTitleSuggestionUsage.value = null
}

const deletingChapter = ref(false)
function deleteCurrentChapter() {
  dialog.warning({
    title: '删除章节',
    content: `确定要删除「${chapter.value?.title}」吗？删除后可在回收站恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingChapter.value = true
      try {
        await $fetch(
          `/api/novels/${novelId.value}/chapters/${chapterId.value}`,
          { method: 'DELETE' }
        )
        // 先按旧列表算出相邻章节，再刷新侧边栏列表（去掉已删章节），最后跳转
        const adjacent = nextChapter.value || prevChapter.value
        await refreshAllChapters()
        if (adjacent) {
          navigateTo(`/novels/${novelId.value}/chapters/${adjacent.id}`)
        } else {
          navigateTo(`/novels/${novelId.value}`)
        }
      } catch {
      } finally {
        deletingChapter.value = false
      }
    }
  })
}

function confirmDeleteChapter(ch: { id: number; title: string }) {
  dialog.warning({
    title: '删除章节',
    content: `确定要删除「${ch.title}」吗？删除后可在回收站恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await $fetch(`/api/novels/${novelId.value}/chapters/${ch.id}`, {
          method: 'DELETE'
        })
        // 删的若是当前正在阅读的章节，右侧阅读区会残留已删内容 → 跳到相邻章节，没有则回小说页
        if (ch.id === chapterId.value) {
          const adjacent = nextChapter.value || prevChapter.value
          await refreshAllChapters()
          if (adjacent) {
            await navigateTo(`/novels/${novelId.value}/chapters/${adjacent.id}`)
          } else {
            await navigateTo(`/novels/${novelId.value}`)
          }
        } else {
          await refreshAllChapters()
        }
      } catch {}
    }
  })
}

const showDeletedChapters = ref(false)
const deletedChapters = ref<
  Array<{
    id: number
    title: string
    chapterNumber: number
    wordCount: number | null
    deletedAt: string
  }>
>([])
const loadingDeleted = ref(false)

watch(showDeletedChapters, async (show) => {
  if (!show) return
  loadingDeleted.value = true
  try {
    const data = await $fetch<any>('/api/novels/trash', {
      params: { page: 1, pageSize: 50 }
    })
    deletedChapters.value = (data.chapters?.items || []).filter(
      (ch: any) => ch.novel?.id === novelId.value
    )
  } catch {
  } finally {
    loadingDeleted.value = false
  }
})

async function restoreChapter(id: number) {
  try {
    await $fetch('/api/novels/trash', {
      method: 'POST',
      body: { type: 'chapter', id }
    })
    deletedChapters.value = deletedChapters.value.filter((ch) => ch.id !== id)
    await refreshAllChapters()
    message.success('章节已恢复')
  } catch {}
}

function permanentDeleteChapter(ch: { id: number; title: string }) {
  dialog.error({
    title: '永久删除',
    content: `确定要永久删除「${ch.title}」吗？此操作不可撤销，数据将彻底清除。`,
    positiveText: '永久删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await $fetch('/api/novels/trash', {
          method: 'DELETE',
          body: { type: 'chapter', id: ch.id }
        })
        deletedChapters.value = deletedChapters.value.filter(
          (c) => c.id !== ch.id
        )
        message.success('已永久删除')
      } catch {}
    }
  })
}

const previewingDeletedChapter = ref<{ title: string; content: string } | null>(
  null
)
const showDeletedPreview = ref(false)

async function previewDeletedChapter(id: number) {
  try {
    const data = await $fetch<any>('/api/novels/trash-preview', {
      params: { type: 'chapter', id }
    })
    previewingDeletedChapter.value = {
      title: data.title,
      content: data.content || '（无内容）'
    }
    showDeletedPreview.value = true
  } catch {}
}

const deletedChapterColumns = computed(() => [
  {
    title: '章节',
    key: 'title',
    ellipsis: { tooltip: true },
    render(row: any) {
      return h(
        'span',
        { class: 'text-xs' },
        `第${row.chapterNumber}章 ${row.title}`
      )
    }
  },
  {
    title: '字数',
    key: 'wordCount',
    width: 60,
    render(row: any) {
      return h(
        'span',
        { class: 'text-xs text-(--ui-text-dimmed)' },
        `${row.wordCount || 0}`
      )
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    render(row: any) {
      return h('div', { class: 'flex items-center gap-1' }, [
        h(
          resolveComponent('NButton'),
          {
            size: 'tiny',
            quaternary: true,
            onClick: () => previewDeletedChapter(row.id)
          },
          {
            icon: () =>
              h(resolveComponent('Icon'), {
                icon: 'lucide:eye',
                class: 'w-3.5 h-3.5'
              })
          }
        ),
        h(
          resolveComponent('NButton'),
          {
            size: 'tiny',
            quaternary: true,
            onClick: () => restoreChapter(row.id)
          },
          {
            icon: () =>
              h(resolveComponent('Icon'), {
                icon: 'lucide:rotate-ccw',
                class: 'w-3.5 h-3.5'
              })
          }
        ),
        h(
          resolveComponent('NButton'),
          {
            size: 'tiny',
            quaternary: true,
            onClick: () => permanentDeleteChapter(row)
          },
          {
            icon: () =>
              h(resolveComponent('Icon'), {
                icon: 'lucide:trash-2',
                class: 'w-3.5 h-3.5 text-red-500'
              })
          }
        )
      ])
    }
  }
])

async function createNewChapter() {
  if (creatingChapter.value) return
  creatingChapter.value = true
  try {
    const body: Record<string, unknown> = {
      title: newChapterTitle.value.trim()
    }
    if (newChapterPosition.value !== 'end' && newChapterRefId.value) {
      body.position = newChapterPosition.value
      body.refChapterId = newChapterRefId.value
    }
    const result = await $fetch<{ id: number }>(
      `/api/novels/${novelId.value}/chapters`,
      {
        method: 'POST',
        body
      }
    )
    showNewChapterDialog.value = false
    await refreshAllChapters()
    navigateTo(`/novels/${novelId.value}/chapters/${result.id}`)
  } catch {
  } finally {
    creatingChapter.value = false
  }
}

const { data: chapter, refresh: refreshChapter } = await useFetch<{
  id: number
  chapterNumber: number
  title: string
  content: string | null
  summary: string | null
  status: string
  wordCount: number | null
  updatedAt: string
  createdAt: string
}>(() => `/api/novels/${novelId.value}/chapters/${chapterId.value}`)

type ChapterUpdateResult = {
  chapterNumber?: number
  title?: string
  status?: string
  wordCount?: number | null
  updatedAt?: string
}

type AiStreamPayload = Partial<{
  content: string
  done: boolean
  error: string
}>

interface OutlineItem {
  id: number
  chapterNumber: number
  description: string
  sortOrder: number
}

interface ChapterPlanForm {
  goal: string
  conflict: string
  turningPoint: string
  beats: string
  mustInclude: string
  avoid: string
  interestHooks: string
  pacing: string
  protocol: string
}

interface ChapterPlanIssue {
  code: string
  severity: 'warning' | 'error'
  message: string
}

interface ChapterPlanResponse {
  planId: number
  status: 'draft' | 'needs_revision' | 'accepted' | 'rejected'
  plan: Partial<ChapterPlanForm>
  validation: {
    blocked: boolean
    issues: ChapterPlanIssue[]
  }
}

type ChapterPlanField = keyof ChapterPlanForm

interface ChapterPlanFieldResponse {
  field: ChapterPlanField
  value: string | string[]
}

const chapterPlanGenerationFields: Array<{
  field: ChapterPlanField
  label: string
}> = [
  { field: 'goal', label: '本章目标' },
  { field: 'conflict', label: '核心冲突' },
  { field: 'turningPoint', label: '关键转折' },
  { field: 'beats', label: '剧情节拍' },
  { field: 'mustInclude', label: '必须出现' },
  { field: 'avoid', label: '避免出现' },
  { field: 'interestHooks', label: '兴趣钩子' },
  { field: 'pacing', label: '情绪/节奏' },
  { field: 'protocol', label: '称谓或设定补充' }
]

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function syncCurrentChapterListItem(
  updated: Partial<Omit<ChapterListItem, 'id'>>
) {
  const chapters = allChapters.value
  if (!chapters) return
  const index = chapters.findIndex(
    (chapterItem) => chapterItem.id === chapterId.value
  )
  if (index === -1) return
  const current = chapters[index]
  if (!current) return
  chapters[index] = { ...current, ...updated }
}

const { data: novelInfo } = await useFetch<{
  title: string
  genre?: string | null
  enabledSkillIds?: string | null
  defaultPromptTemplateId?: number | null
}>(`/api/novels/${novelId.value}`, {
  pick: ['title', 'genre', 'enabledSkillIds', 'defaultPromptTemplateId']
})
const { data: aiConfigs } = await useFetch<
  Array<{
    id: number
    purpose: string
    temperature?: string | null
    topP?: string | null
    thinkingEnabled?: boolean | null
    reasoningEffort?: 'low' | 'medium' | 'high' | null
    isDefault: boolean
    enabled: boolean
    operational: boolean
    aiModel: {
      id: number
      name: string
      model: string
      maxTokens?: number | null
      enabled: boolean
      supportsThinking: boolean
      thinkingEnabled: boolean
      temperatureDefault: number
      topPDefault: number
      samplingLockedWhenThinking: boolean
    }
  }>
>('/api/ai/config', { default: () => [] })
const { data: preferences } = await useFetch<Record<string, string>>(
  '/api/settings/preferences',
  {
    default: () => ({})
  }
)
const { data: novelOutlines, refresh: refreshNovelOutlines } = await useFetch<
  OutlineItem[]
>(() => `/api/novels/${novelId.value}/outlines`, {
  default: () => []
})
const { aiStatus, refreshAiStatus, isRefreshing } = useAiConnectivity()
const { recordReading } = useReadingHistory()
const aiStatusHydrated = ref(false)
const aiActionAvailable = computed(
  () => aiStatusHydrated.value && aiStatus.value.available
)

async function retryAiStatus() {
  await refreshAiStatus({
    check: true,
    aiConfigId: selectedAiConfigId.value
  })
  if (aiStatus.value.available) {
    message.success('AI 已恢复连接')
  } else {
    message.warning(aiStatus.value.reason || 'AI 仍然离线，请检查模型配置')
  }
}

onMounted(() => {
  aiStatusHydrated.value = true
})

watch(
  [() => chapter.value, () => novelInfo.value],
  ([ch, novel]) => {
    if (ch) {
      const prefix = novel?.title ? `${novel.title} · ` : ''
      const t = stripChapterNumberPrefix(ch.title)
      updateActiveTabTitle(`${prefix}Ch.${ch.chapterNumber}${t ? ` ${t}` : ''}`)
    }
    if (ch && novel) {
      recordReading({
        novelId: novelId.value,
        novelTitle: novel.title,
        chapterId: ch.id,
        chapterNumber: ch.chapterNumber,
        chapterTitle: ch.title
      })
    }
  },
  { immediate: true }
)

const content = ref(chapter.value?.content || '')
const saving = ref(false)
const lastSaved = ref<Date | null>(null)
const generating = ref(false)
const generatedContent = ref('')
const generatedContentScrollRef = ref<HTMLElement | null>(null)
const showGenerateDialog = ref(false)
const generateDirection = ref('')
const selectedAiConfigId = ref<number | undefined>()
const generateTemperature = ref<number>(0.7)
const generateTopP = ref<number>(0.95)
const generateThinkingEnabled = ref<boolean | null>(null)
const generateReasoningEffort = ref<'low' | 'medium' | 'high' | null>(null)
const generateMaxTokens = ref<number>(4096)
const generateWizardStep = ref(1)
const generationContextPreviewRef = ref<{
  fetchPreview: () => Promise<void>
} | null>(null)
const generationContextSelection = ref<GenerationContextSelection | null>(null)
const generationContextReady = ref(false)
const refreshingGenerationContext = ref(false)
const chapterOutlineDraft = ref('')
const outlineIdea = ref('')
const generatingChapterOutline = ref(false)
const savingChapterOutline = ref(false)
const generatingChapterPlan = ref(false)
const acceptingChapterPlan = ref(false)
const acceptedWorkflowPlanId = ref<number | null>(null)
const currentWorkflowPlanId = ref<number | null>(null)
const chapterPlanIssues = ref<ChapterPlanIssue[]>([])
const chapterPlanBlocked = ref(false)
const chapterPlanForm = reactive<ChapterPlanForm>({
  goal: '',
  conflict: '',
  turningPoint: '',
  beats: '',
  mustInclude: '',
  avoid: '',
  interestHooks: '',
  pacing: '',
  protocol: ''
})
const zenMode = ref(false)
const zenFontSize = ref(Number(preferences.value?.zen_font_size || 18))
const zenFontFamily = ref(preferences.value?.zen_font_family || 'serif')

let zenPrefTimer: ReturnType<typeof setTimeout> | null = null
function saveZenPrefs() {
  if (zenPrefTimer) clearTimeout(zenPrefTimer)
  zenPrefTimer = setTimeout(async () => {
    try {
      await Promise.all([
        $fetch('/api/settings/preferences', {
          method: 'PUT',
          body: { key: 'zen_font_size', value: String(zenFontSize.value) }
        }),
        $fetch('/api/settings/preferences', {
          method: 'PUT',
          body: { key: 'zen_font_family', value: zenFontFamily.value }
        })
      ])
    } catch {}
  }, 800)
}
watch(zenFontSize, saveZenPrefs)
watch(zenFontFamily, saveZenPrefs)

const showShortcutHelp = ref(false)
const conflictDetected = ref(false)
const serverUpdatedAt = ref(chapter.value?.updatedAt || null)
const consistencyWarningsRef = ref<{ refresh: () => void } | null>(null)
const pageRootRef = ref<HTMLElement | null>(null)
const pageHeight = ref('calc(100dvh - 7.5rem)')
let pageResizeObserver: ResizeObserver | null = null

const editingChapterTitle = ref(false)
const editTitleValue = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const showFloatingToolbar = ref(false)
const floatingToolbarPos = reactive({ x: 0, y: 0 })
const selectedText = ref('')
const savedEditorSelection = ref<{ from: number; to: number } | null>(null)
const expandingOrRewriting = ref(false)
const aiActionResult = ref('')
const aiActionType = ref<'expand' | 'rewrite' | 'continue' | null>(null)

/* ─────────────── 反馈式重生成 ─────────────── */
const previousGeneratedContent = ref('')
const showFeedbackInput = ref(false)
const feedbackText = ref('')
const regenerating = ref(false)
let activeAbortController: AbortController | null = null

function stopGeneration() {
  activeAbortController?.abort()
}

/* ─────────────── Prompt 模板 ─────────────── */
interface PromptTemplate {
  id: number
  name: string
  content: string
  category: string
  isSystem: boolean
}
const promptTemplates = ref<PromptTemplate[]>([])
const selectedTemplateId = ref<number | null>(null)

const directionDirty = ref(false)
let applyingTemplate = false

async function fetchPromptTemplates() {
  try {
    const data = await $fetch<PromptTemplate[]>('/api/ai/templates')
    promptTemplates.value = data.filter(
      (t) => t.category === 'generation' || t.category === 'custom'
    )
    // 需求2 自动选模板：本章已选 → 小说默认 → 首章「开篇引入」→ 上次使用
    if (!selectedTemplateId.value && promptTemplates.value.length) {
      const has = (id: number | null | undefined) =>
        id != null && promptTemplates.value.some((t) => t.id === id)
      const novelDefault = novelInfo.value?.defaultPromptTemplateId
      const hasNoChapters = !allChapters.value?.length
      const saved = Number(
        localStorage.getItem('chapter_last_prompt_template_id') || 0
      )
      let pick: number | null = null
      if (has(novelDefault)) pick = novelDefault!
      else if (hasNoChapters) {
        const opening = promptTemplates.value.find(
          (t) => t.isSystem && t.name === '开篇引入'
        )
        if (opening) pick = opening.id
      }
      if (pick == null && has(saved)) pick = saved
      if (pick != null) {
        selectedTemplateId.value = pick
        applyTemplate(pick, true)
      }
    }
  } catch {}
}

// auto=true 为自动套用：仅在方向框为空、且用户未手动编辑过时填充，避免覆盖你已写的方向。
function applyTemplate(id: number | null, auto = false) {
  if (!id) return
  const tpl = promptTemplates.value.find((t) => t.id === id)
  if (!tpl) return
  if (auto && (directionDirty.value || generateDirection.value.trim())) return
  applyingTemplate = true
  generateDirection.value = tpl.content
  directionDirty.value = false
  nextTick(() => {
    applyingTemplate = false
  })
}

watch(selectedTemplateId, (id) => {
  if (id) localStorage.setItem('chapter_last_prompt_template_id', String(id))
})

// 用户手动编辑方向框 → 标记 dirty，之后自动套用不再覆盖
watch(generateDirection, () => {
  if (!applyingTemplate) directionDirty.value = true
})

const showSaveTemplateInput = ref(false)
const newTemplateName = ref('')

async function saveAsTemplate() {
  if (!newTemplateName.value.trim() || !generateDirection.value.trim()) return
  try {
    await $fetch('/api/ai/templates', {
      method: 'POST',
      body: {
        name: newTemplateName.value.trim(),
        content: generateDirection.value.trim(),
        category: 'generation'
      }
    })
    showSaveTemplateInput.value = false
    newTemplateName.value = ''
    await fetchPromptTemplates()
  } catch {}
}

async function deleteTemplate(id: number) {
  try {
    await $fetch('/api/ai/templates', { method: 'DELETE', query: { id } })
    await fetchPromptTemplates()
    if (selectedTemplateId.value === id) selectedTemplateId.value = null
  } catch {}
}

/* ─────────────── 写作技能包（Skill） ─────────────── */
interface WritingSkill {
  id: number
  name: string
  description: string | null
  genre: string | null
  systemAddon: string | null
  fewShots: Array<{ scene: string; content: string }>
  checklist: string[]
  appliesTo: string[]
  isSystem: boolean
  enabled: boolean
}
const writingSkills = ref<WritingSkill[]>([])
const selectedSkillIds = ref<number[]>([])
const savingNovelDefault = ref(false)

function parseIdList(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((n) => typeof n === 'number') : []
  } catch {
    return []
  }
}

const skillOptions = computed(() =>
  writingSkills.value.map((s) => ({
    label: s.genre ? s.name : `${s.name}（通用）`,
    value: s.id
  }))
)

async function fetchWritingSkills() {
  try {
    const data = await $fetch<WritingSkill[]>('/api/ai/skills')
    writingSkills.value = data
    if (!selectedSkillIds.value.length) {
      const enabled = parseIdList(novelInfo.value?.enabledSkillIds)
      if (enabled.length) {
        // 已设本书默认：保留仍存在的
        selectedSkillIds.value = enabled.filter((id) =>
          data.some((s) => s.id === id)
        )
      } else {
        // 需求5：未设默认时，按小说题材自动勾选「通用 + 同题材」系统包，跟随小说类型
        const genre = novelInfo.value?.genre || null
        selectedSkillIds.value = data
          .filter((s) => s.isSystem && (!s.genre || s.genre === genre))
          .map((s) => s.id)
      }
    }
  } catch {}
}

// 设为本书默认：把当前勾选的技能包写入小说，之后每章自动启用，免再勾选。
async function saveSkillsAsNovelDefault() {
  savingNovelDefault.value = true
  try {
    await $fetch(`/api/novels/${novelId.value}`, {
      method: 'PUT',
      body: { enabledSkillIds: selectedSkillIds.value }
    })
    message.success('已设为本书默认技能包')
  } catch {
    message.error('保存失败')
  } finally {
    savingNovelDefault.value = false
  }
}

// 设为本书默认生成模板（需求2）：之后新章自动套用此模板。
async function saveTemplateAsNovelDefault() {
  if (!selectedTemplateId.value) return
  try {
    await $fetch(`/api/novels/${novelId.value}`, {
      method: 'PUT',
      body: { defaultPromptTemplateId: selectedTemplateId.value }
    })
    message.success('已设为本书默认模板')
  } catch {
    message.error('保存失败')
  }
}

/* ─────────────── 中断草稿恢复 ─────────────── */
const {
  draftRecovery,
  loadDraftRecovery,
  saveDraftRecovery,
  clearDraftRecovery
} = useDraftRecovery(novelId, chapterId)

/* ─────────────── AI 建议模式 ─────────────── */
const {
  suggestions,
  isActive: suggestionModeActive,
  loading: suggestionsLoading,
  pendingCount: suggestionsPendingCount,
  fetchSuggestions,
  acceptSuggestion: acceptSuggestionAt,
  rejectSuggestion: rejectSuggestionAt,
  rejectAll: rejectAllSuggestions,
  clearSuggestions
} = useSuggestionMode(novelId, chapterId)

async function startSuggestionMode() {
  await fetchSuggestions(selectedAiConfigId.value)
}

function applySuggestion(index: number) {
  const suggestion = suggestions.value[index]
  if (!suggestion || !content.value) return
  const newContent = content.value.replace(
    suggestion.originalText,
    suggestion.suggestedText
  )
  if (newContent !== content.value) {
    content.value = newContent
    setEditorMarkdown(newContent)
  }
  acceptSuggestionAt(index)
}

function applyAllAcceptedSuggestions() {
  let newContent = content.value || ''
  for (const s of suggestions.value) {
    if (s.status === 'pending') {
      newContent = newContent.replace(s.originalText, s.suggestedText)
      s.status = 'accepted'
    }
  }
  if (newContent !== content.value) {
    content.value = newContent
    setEditorMarkdown(newContent)
  }
  clearSuggestions()
}

async function applyDraftRecovery() {
  if (!draftRecovery.value) return
  const { content: draftContent, type } = draftRecovery.value
  if (type === 'generate') {
    await setEditorMarkdown(draftContent)
    content.value = draftContent
    await saveContent()
  } else {
    aiActionResult.value = draftContent
    aiActionType.value = type
  }
  clearDraftRecovery()
}

let draftLastSavedLength = 0

watch(generatedContent, (val) => {
  if (generating.value && val) {
    if (val.length - draftLastSavedLength >= 500 || !generating.value) {
      saveDraftRecovery(val, 'generate')
      draftLastSavedLength = val.length
    }
  } else {
    draftLastSavedLength = 0
  }
  nextTick(() => {
    const el = generatedContentScrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})

watch(aiActionResult, (val) => {
  if (expandingOrRewriting.value && val && aiActionType.value) {
    if (val.length - draftLastSavedLength >= 500) {
      saveDraftRecovery(val, aiActionType.value)
      draftLastSavedLength = val.length
    }
  } else {
    draftLastSavedLength = 0
  }
})

/* ─────────────── Milkdown 编辑器 ─────────────── */
const {
  containerRef: editorContainerRef,
  createEditor,
  setMarkdown: setEditorMarkdown,
  getSelectionText: getEditorSelectionText,
  getSelectionRange: getEditorSelectionRange,
  replaceSelection: replaceEditorSelection,
  insertTextAtCursor: insertEditorTextAtCursor,
  focus: focusEditor,
  getContextBeforeCursor,
  setEditable: setEditorEditable
} = useMilkdownEditor({
  onChange: (md) => {
    content.value = md
  }
})

watch(
  [generating, regenerating, expandingOrRewriting],
  ([gen, regen, expanding]) => {
    setEditorEditable(!gen && !regen && !expanding)
  }
)

/* ─────────────── 角色 ─────────────── */
type CharacterProfileField =
  | 'description'
  | 'traits'
  | 'relationships'
  | 'currentState'
  | 'realName'
  | 'displayTitle'
  | 'rolePosition'
  | 'storyRole'

type CharacterListItem = {
  id: number
  name: string
  description: string | null
  traits: string | null
  relationships: string | null
  currentState: string | null
  realName: string | null
  displayTitle: string | null
  rolePosition: string | null
  storyRole: string | null
}

type CharacterStateChangeItem = {
  id: number
  chapterNumber: number
  chapterTitle: string
  characterId: number
  characterName: string
  relatedCharacterName: string | null
  changeType: string
  afterValue: string
  reason: string | null
  evidenceQuote: string | null
  confidence: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'reverted'
  source: 'ai' | 'manual'
  isStale: boolean
}

const { data: allCharacters, refresh: refreshAllCharacters } = await useFetch<
  Array<CharacterListItem>
>(`/api/novels/${novelId.value}/characters`)

const detectedCharacterIds = ref<Set<number>>(new Set())
const extractingChars = ref(false)
const selectedCharacterIds = ref<Set<number>>(new Set())
const savingChapterCharacters = ref(false)
const aiExtractingCharacters = ref(false)
const extractingCharacterStateChanges = ref(false)
const enrichingCharacterIds = ref<Set<number>>(new Set())
let detectTimeout: ReturnType<typeof setTimeout> | null = null

const { data: chapterCharacters, refresh: refreshChapterCharacters } =
  await useFetch<
    Array<{
      characterId: number
      characterName: string
      characterDescription: string | null
      role: 'main' | 'supporting' | 'mentioned'
      appearances: Array<{
        id: number
        snippet: string | null
        background: string | null
        role: 'main' | 'supporting' | 'mentioned'
        positionStart: number | null
        positionEnd: number | null
      }>
    }>
  >(
    () => `/api/novels/${novelId.value}/chapters/${chapterId.value}/characters`,
    {
      default: () => []
    }
  )

const { data: characterStateChanges, refresh: refreshCharacterStateChanges } =
  await useFetch<CharacterStateChangeItem[]>(
    () =>
      `/api/novels/${novelId.value}/chapters/${chapterId.value}/character-state-changes`,
    {
      default: () => []
    }
  )

function detectCharactersFromContent() {
  extractingChars.value = true
  if (!allCharacters.value || !content.value) {
    detectedCharacterIds.value = new Set()
    extractingChars.value = false
    return
  }
  const found = new Set<number>()
  const normalizedContent = normalizeCharacterMatchText(content.value)
  for (const char of allCharacters.value) {
    const normalizedName = normalizeCharacterMatchText(char.name)
    if (normalizedName && normalizedContent.includes(normalizedName)) {
      found.add(char.id)
    }
  }
  detectedCharacterIds.value = found
  extractingChars.value = false
}

function normalizeCharacterMatchText(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

function hasMissingCharacterProfile(character: CharacterListItem) {
  return (
    !character.realName?.trim() ||
    !character.displayTitle?.trim() ||
    !character.rolePosition?.trim() ||
    !character.storyRole?.trim() ||
    !character.description?.trim() ||
    !character.traits?.trim() ||
    !character.relationships?.trim() ||
    !character.currentState?.trim()
  )
}

function isEnrichingCharacter(characterId: number) {
  return enrichingCharacterIds.value.has(characterId)
}

function setCharacterEnriching(characterId: number, loading: boolean) {
  const next = new Set(enrichingCharacterIds.value)
  if (loading) next.add(characterId)
  else next.delete(characterId)
  enrichingCharacterIds.value = next
}

onMounted(detectCharactersFromContent)
onMounted(scrollCurrentChapterIntoView)

// 内容变化时自动检测角色（debounce 500ms）
watch(content, () => {
  if (detectTimeout) clearTimeout(detectTimeout)
  detectTimeout = setTimeout(detectCharactersFromContent, 500)
})

// 初始检测
watch(
  () => allCharacters.value,
  () => {
    detectCharactersFromContent()
  },
  { once: true }
)

const detectedCharacters = computed(() => {
  if (!allCharacters.value) return []
  return allCharacters.value.filter((c) => detectedCharacterIds.value.has(c.id))
})

const selectedCharacters = computed(() => {
  if (!allCharacters.value) return []
  return allCharacters.value.filter((c) => selectedCharacterIds.value.has(c.id))
})

const selectedChapterCharacters = computed(() => {
  return selectedCharacters.value.map((character) => {
    const assignment = chapterCharacters.value.find(
      (item) => item.characterId === character.id
    )
    return {
      ...character,
      appearances: assignment?.appearances || []
    }
  })
})

const visibleCharacterStateChanges = computed(() => {
  return (characterStateChanges.value || []).filter((change) => {
    return change.status === 'pending' || change.status === 'accepted'
  })
})

const pendingCharacterStateChangeCount = computed(() => {
  return visibleCharacterStateChanges.value.filter(
    (change) => change.status === 'pending'
  ).length
})

const characterStateChangeLabels: Record<string, string> = {
  description: '简介',
  traits: '性格',
  relationships: '关系',
  currentState: '状态',
  realName: '本名',
  displayTitle: '称呼',
  rolePosition: '身份',
  storyRole: '作用',
  overallArc: '弧线'
}

function getCharacterStateChangeLabel(changeType: string) {
  return characterStateChangeLabels[changeType] || changeType
}

function syncSelectedCharactersFromServer() {
  selectedCharacterIds.value = new Set(
    chapterCharacters.value.map((item) => item.characterId)
  )
}

watch(
  () => chapter.value?.id,
  async (newId, oldId) => {
    content.value = chapter.value?.content || ''
    serverUpdatedAt.value = chapter.value?.updatedAt || null
    if (newId !== oldId) {
      await setEditorMarkdown(content.value)
      currentWorkflowPlanId.value = null
      resetAcceptedChapterPlan()
      chapterPlanIssues.value = []
      chapterPlanBlocked.value = false
    }
    nextTick(detectCharactersFromContent)
    scrollCurrentChapterIntoView()
  }
)

onMounted(async () => {
  await createEditor(content.value)
  loadDraftRecovery()
  fetchPromptTemplates()
  fetchWritingSkills()
  loadUserPresets()
})

watch(
  [() => allChapters.value, chapterId, leftSidebarTab, sidebarCollapsed],
  () => {
    scrollCurrentChapterIntoView()
  }
)

watch(
  () => chapterCharacters.value,
  () => {
    syncSelectedCharactersFromServer()
  },
  { immediate: true }
)

function toggleChapterCharacter(characterId: number) {
  const next = new Set(selectedCharacterIds.value)
  if (next.has(characterId)) next.delete(characterId)
  else next.add(characterId)
  selectedCharacterIds.value = next
  resetAcceptedChapterPlan()
}

function applyDetectedCharacters() {
  selectedCharacterIds.value = new Set(detectedCharacterIds.value)
  resetAcceptedChapterPlan()
}

async function saveChapterCharacters() {
  savingChapterCharacters.value = true
  try {
    await $fetch(
      `/api/novels/${novelId.value}/chapters/${chapterId.value}/characters`,
      {
        method: 'PUT',
        body: {
          characters: Array.from(selectedCharacterIds.value).map(
            (characterId) => ({
              characterId,
              role: 'supporting'
            })
          )
        }
      }
    )
    await refreshChapterCharacters()
    syncSelectedCharactersFromServer()
  } finally {
    savingChapterCharacters.value = false
  }
}

async function extractCharactersWithAi() {
  aiExtractingCharacters.value = true
  try {
    await saveContent()
    await $fetch(
      `/api/novels/${novelId.value}/chapters/${chapterId.value}/extract-characters`,
      { method: 'POST' }
    )
    await Promise.all([refreshAllCharacters(), refreshChapterCharacters()])
    syncSelectedCharactersFromServer()
    detectCharactersFromContent()
  } finally {
    aiExtractingCharacters.value = false
  }
}

async function extractCharacterStateChanges() {
  if (extractingCharacterStateChanges.value) return
  extractingCharacterStateChanges.value = true
  try {
    await saveContent()
    const result = await apiPost<{
      created: number
      accepted: number
      pending: number
      skipped: number
    }>(
      `/api/novels/${novelId.value}/chapters/${chapterId.value}/character-state-changes/extract`,
      { replaceAi: true },
      { successMessage: '人物变化分析完成' }
    )
    await Promise.all([refreshCharacterStateChanges(), refreshAllCharacters()])
    message.info(
      `新增 ${result.created} 条，自动确认 ${result.accepted} 条，待确认 ${result.pending} 条`
    )
  } finally {
    extractingCharacterStateChanges.value = false
  }
}

async function enrichChapterCharacter(character: CharacterListItem) {
  if (isEnrichingCharacter(character.id)) return
  if (!hasMissingCharacterProfile(character)) {
    message.info('该角色资料已完整，无需补全')
    return
  }

  setCharacterEnriching(character.id, true)
  try {
    const result = await apiPost<{
      enriched: Partial<Record<CharacterProfileField, string>>
    }>(`/api/novels/${novelId.value}/characters/${character.id}/enrich`, {
      name: character.name,
      description: character.description || undefined,
      traits: character.traits || undefined,
      relationships: character.relationships || undefined,
      currentState: character.currentState || undefined,
      realName: character.realName || undefined,
      displayTitle: character.displayTitle || undefined,
      rolePosition: character.rolePosition || undefined,
      storyRole: character.storyRole || undefined
    })

    const updates: Partial<Record<CharacterProfileField, string>> = {}
    for (const field of [
      'realName',
      'displayTitle',
      'rolePosition',
      'storyRole',
      'description',
      'traits',
      'relationships',
      'currentState'
    ] as const) {
      if (result.enriched[field] && !character[field]?.trim()) {
        updates[field] = result.enriched[field]
      }
    }

    if (!Object.keys(updates).length) {
      message.info('AI 没有返回可补充字段')
      return
    }

    await apiPut(
      `/api/novels/${novelId.value}/characters/${character.id}`,
      updates,
      { successMessage: '角色资料已补全' }
    )
    await refreshAllCharacters()
    detectCharactersFromContent()
  } finally {
    setCharacterEnriching(character.id, false)
  }
}

/* ─────────────── 编辑器插入角色 ─────────────── */
function insertCharacterName(name: string) {
  insertEditorTextAtCursor(name)
  nextTick(() => focusEditor())
}

function formatSamplingNumber(
  value: number | string | null | undefined,
  fallback: number
) {
  const parsed = typeof value === 'number' ? value : Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : fallback.toFixed(2)
}

const generationModelOptions = computed(() =>
  aiConfigs.value
    .filter(
      (config) =>
        config.purpose === 'generation' && config.enabled && config.operational
    )
    .map((config) => {
      const thinkingEnabled =
        config.aiModel.supportsThinking &&
        (config.thinkingEnabled ?? config.aiModel.thinkingEnabled)
      const samplingLocked =
        thinkingEnabled && config.aiModel.samplingLockedWhenThinking
      const temperature =
        samplingLocked ? config.aiModel.temperatureDefault : config.temperature
      const topP = samplingLocked ? config.aiModel.topPDefault : config.topP
      return {
        label:
          config.isDefault ?
            `内容生成 / ${config.aiModel.name} · 默认`
          : `内容生成 / ${config.aiModel.name}`,
        value: config.id,
        description: `${config.aiModel.model} · ${samplingLocked ? '模型默认采样' : '自定义采样'} · T ${formatSamplingNumber(temperature, 0.7)} · top_p ${formatSamplingNumber(topP, 0.95)}`,
        isDefault: config.isDefault
      }
    })
)

const selectedGenerationConfig = computed(() => {
  return aiConfigs.value.find(
    (config) => config.id === selectedAiConfigId.value
  )
})

const selectedGenerationConfigBadge = computed(() => {
  const config = selectedGenerationConfig.value
  if (!config) return '内容生成'
  return config.isDefault ? '内容生成 · 默认' : '内容生成'
})

const selectedGenerationConfigTitle = computed(() => {
  const config = selectedGenerationConfig.value
  if (!config) return '选择生成配置'
  return config.aiModel?.name || '未知模型'
})

const selectedGenerationThinkingEnabled = computed(() => {
  const config = selectedGenerationConfig.value
  if (!config?.aiModel.supportsThinking) return false
  return generateThinkingEnabled.value ?? config.aiModel.thinkingEnabled
})

const generationSamplingLocked = computed(() => {
  const config = selectedGenerationConfig.value
  return Boolean(
    config?.aiModel.supportsThinking &&
    config.aiModel.samplingLockedWhenThinking &&
    selectedGenerationThinkingEnabled.value
  )
})

const effectiveGenerationTemperature = computed(() => {
  const config = selectedGenerationConfig.value
  if (generationSamplingLocked.value) {
    return config?.aiModel.temperatureDefault ?? 0.7
  }
  return generateTemperature.value
})

const effectiveGenerationTopP = computed(() => {
  const config = selectedGenerationConfig.value
  if (generationSamplingLocked.value) {
    return config?.aiModel.topPDefault ?? 0.95
  }
  return generateTopP.value
})

const selectedGenerationConfigMeta = computed(() => {
  const config = selectedGenerationConfig.value
  if (!config) return '请到 AI 配置添加可用的内容生成配置'
  const samplingText =
    generationSamplingLocked.value ? '模型默认采样' : '自定义采样'
  return `${config.aiModel.model} · ${samplingText} · T ${formatSamplingNumber(effectiveGenerationTemperature.value, 0.7)} · top_p ${formatSamplingNumber(effectiveGenerationTopP.value, 0.95)}`
})

const generationSamplingHint = computed(() => {
  if (generationSamplingLocked.value) {
    return '当前模型启用思考时会使用模型默认采样值，温度和 top_p 覆盖不会生效。'
  }
  return '控制候选词采样范围'
})

const reasoningOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' }
] as const

const plainTextContent = computed(() =>
  content.value.replace(/[#>*_`\-[\]()]/g, '').trim()
)
const currentWordCount = computed(
  () => plainTextContent.value.replace(/\s/g, '').length
)
const currentLineCount = computed(() =>
  content.value ? content.value.split('\n').length : 0
)
const chapterGoal = computed(() =>
  Number(preferences.value.writing_chapter_goal || 3000)
)
const chapterProgress = computed(() => {
  if (chapterGoal.value <= 0) return 0
  return Math.min(
    Math.round((currentWordCount.value / chapterGoal.value) * 100),
    100
  )
})
const saveStatusText = computed(() => {
  if (conflictDetected.value) return '保存冲突'
  if (saving.value) return '保存中...'
  if ((content.value || '') !== (chapter.value?.content || '')) return '待保存'
  if (lastSaved.value)
    return `已保存 ${lastSaved.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  return '已同步'
})
const saveStatusClass = computed(() => {
  if (conflictDetected.value) return 'text-red-500'
  if (saving.value || content.value !== chapter.value?.content)
    return 'text-amber-500'
  return 'text-emerald-500'
})

watch(
  generationModelOptions,
  (options) => {
    if (!options.length) {
      selectedAiConfigId.value = undefined
      return
    }
    if (
      !selectedAiConfigId.value ||
      !options.some((option) => option.value === selectedAiConfigId.value)
    ) {
      selectedAiConfigId.value =
        options.find((option) => option.isDefault)?.value ?? options[0]?.value
    }
  },
  { immediate: true }
)

watch(
  selectedAiConfigId,
  async (configId) => {
    if (!configId || aiStatus.value.available || isRefreshing.value) return
    await refreshAiStatus({ aiConfigId: configId })
  },
  { immediate: true }
)

watch(
  selectedGenerationConfig,
  (config) => {
    if (config) {
      generateTemperature.value = parseFloat(config.temperature ?? '0.7')
      generateTopP.value = parseFloat(config.topP ?? '0.95')
      generateThinkingEnabled.value = config.thinkingEnabled ?? null
      generateReasoningEffort.value = config.reasoningEffort ?? null
      generateMaxTokens.value = config.aiModel?.maxTokens || 4096
    }
  },
  { immediate: true }
)

const presetCycle = [
  { name: '创意', temperature: 0.9 },
  { name: '平衡', temperature: 0.7 },
  { name: '精确', temperature: 0.3 }
] as const

interface UserPreset {
  id: string
  name: string
  temperature: string
  maxTokens: number
  configId?: number
}
const userPresets = ref<UserPreset[]>([])

async function loadUserPresets() {
  try {
    const prefs = await $fetch<Record<string, string>>(
      '/api/settings/preferences'
    )
    if (prefs.ai_custom_presets) {
      userPresets.value = JSON.parse(prefs.ai_custom_presets)
    }
  } catch {}
}

const allPresets = computed(() => [
  ...presetCycle.map((p) => ({
    name: p.name,
    temperature: p.temperature,
    configId: undefined as number | undefined
  })),
  ...userPresets.value.map((p) => ({
    name: p.name,
    temperature: parseFloat(p.temperature),
    configId: p.configId
  }))
])

const currentPresetLabel = computed(() => {
  const temp = generateTemperature.value
  const userMatch = userPresets.value.find(
    (p) => parseFloat(p.temperature) === temp
  )
  if (userMatch) return userMatch.name
  if (temp >= 0.85) return '创意'
  if (temp >= 0.5) return '平衡'
  return '精确'
})

const samplingSummaryLabel = computed(() => {
  if (generationSamplingLocked.value) {
    return `模型默认 · T ${formatSamplingNumber(effectiveGenerationTemperature.value, 0.7)}`
  }
  return `${currentPresetLabel.value} · T ${formatSamplingNumber(generateTemperature.value, 0.7)}`
})

function cyclePreset() {
  if (generationSamplingLocked.value) return
  const currentIdx = allPresets.value.findIndex(
    (p) => p.name === currentPresetLabel.value
  )
  const next = allPresets.value[(currentIdx + 1) % allPresets.value.length]!
  generateTemperature.value = next.temperature
  if (
    next.configId &&
    generationModelOptions.value.some(
      (option) => option.value === next.configId
    )
  ) {
    selectedAiConfigId.value = next.configId
  }
}

const estimatedContextTokens = computed(() =>
  Math.round(currentWordCount.value * 1.5)
)

const sortedNovelOutlines = computed(() =>
  [...novelOutlines.value].sort((left, right) => {
    return (
      left.chapterNumber - right.chapterNumber ||
      left.sortOrder - right.sortOrder
    )
  })
)

const currentChapterOutline = computed(() => {
  const number = chapter.value?.chapterNumber
  if (!number) return null
  return (
    sortedNovelOutlines.value.find(
      (outline) => outline.chapterNumber === number
    ) || null
  )
})

const recommendedCharactersByOutline = computed(() => {
  const outline = normalizeCharacterMatchText(chapterOutlineDraft.value)
  if (!outline || !allCharacters.value) return []
  return allCharacters.value.filter((character) => {
    const name = normalizeCharacterMatchText(character.name)
    if (name && outline.includes(name)) return true
    const description = normalizeCharacterMatchText(
      `${character.description || ''}${character.traits || ''}${character.relationships || ''}${character.currentState || ''}${character.realName || ''}${character.displayTitle || ''}${character.rolePosition || ''}${character.storyRole || ''}`
    )
    return description.length >= 2 && outline.includes(description.slice(0, 8))
  })
})

function isTitleLikeCharacterName(name: string) {
  return /(美人|才人|婕妤|贵人|嫔|妃|贵妃|皇后|娘娘|小主)$/.test(name)
}

function getCharacterNote(character: {
  name: string
  description: string | null
  traits: string | null
  relationships?: string | null
  currentState?: string | null
  realName?: string | null
  displayTitle?: string | null
  rolePosition?: string | null
  storyRole?: string | null
}) {
  const identityParts = [
    character.realName ? `本名：${character.realName}` : '',
    character.displayTitle ? `称呼/位分：${character.displayTitle}` : '',
    character.rolePosition ? `身份：${character.rolePosition}` : '',
    character.storyRole ? `作用：${character.storyRole}` : ''
  ]
    .map((item) => item.trim())
    .filter(Boolean)
  const parts = [
    identityParts.join('；'),
    character.description,
    character.traits ? `特征：${character.traits}` : '',
    character.relationships ? `关系：${character.relationships}` : '',
    character.currentState ? `当前：${character.currentState}` : ''
  ]
    .map((item) => item?.trim())
    .filter(Boolean)

  if (parts.length) return parts.join('；')
  if (isTitleLikeCharacterName(character.name)) {
    return '疑似称谓/位分，建议补充本名、身份和与主角关系'
  }
  return '缺少角色备注，建议补充身份和剧情作用'
}

const chapterPlanDirection = computed(() => {
  return [
    ['本章目标', chapterPlanForm.goal],
    ['核心冲突', chapterPlanForm.conflict],
    ['关键转折', chapterPlanForm.turningPoint],
    ['剧情节拍', chapterPlanForm.beats],
    ['必须出现', chapterPlanForm.mustInclude],
    ['避免出现', chapterPlanForm.avoid],
    ['兴趣钩子', chapterPlanForm.interestHooks],
    ['情绪/节奏', chapterPlanForm.pacing],
    ['称谓或设定补充', chapterPlanForm.protocol]
  ]
    .map(([label, value]) => {
      const text = String(value || '').trim()
      return text ? `${label}：${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
})

watch(
  () => [
    chapterPlanForm.goal,
    chapterPlanForm.conflict,
    chapterPlanForm.turningPoint,
    chapterPlanForm.beats,
    chapterPlanForm.mustInclude,
    chapterPlanForm.avoid,
    chapterPlanForm.interestHooks,
    chapterPlanForm.pacing,
    chapterPlanForm.protocol
  ],
  () => {
    resetAcceptedChapterPlan()
  }
)

const generationContextSummary = computed(() => {
  const direction = [generateDirection.value, chapterPlanDirection.value]
    .filter(Boolean)
    .join('\n')
    .trim()
  return [
    {
      label: '本章大纲',
      value: chapterOutlineDraft.value.trim() || '未填写'
    },
    {
      label: '推荐角色',
      value: `${recommendedCharactersByOutline.value.length} 个`
    },
    {
      label: '已选角色',
      value: `${selectedChapterCharacters.value.length} 个`
    },
    {
      label: '剧情要求',
      value: direction ? '已填写' : '未填写，将按大纲生成'
    },
    {
      label: '当前正文',
      value: `${currentWordCount.value} 字 / 约 ${estimatedContextTokens.value} tokens`
    }
  ]
})

function openGenerateWizard() {
  generateWizardStep.value = 1
  chapterOutlineDraft.value = currentChapterOutline.value?.description || ''
  outlineIdea.value = generateDirection.value.trim()
  generationContextSelection.value = null
  generationContextReady.value = false
  showGenerateDialog.value = true
}

function applyRecommendedCharacters() {
  const next = new Set(selectedCharacterIds.value)
  for (const character of recommendedCharactersByOutline.value) {
    next.add(character.id)
  }
  selectedCharacterIds.value = next
  resetAcceptedChapterPlan()
}

function buildFinalGenerateDirection() {
  return [generateDirection.value.trim(), chapterPlanDirection.value]
    .filter(Boolean)
    .join('\n\n')
}

async function nextGenerateWizardStep() {
  if (generateWizardStep.value === 1) {
    if (!chapterOutlineDraft.value.trim()) {
      message.warning('请先确认本章大纲')
      return
    }
    applyRecommendedCharacters()
  }
  if (generateWizardStep.value === 2) {
    await saveChapterCharacters()
  }
  if (generateWizardStep.value === 3 && !acceptedWorkflowPlanId.value) {
    message.warning('请先生成并验收大致剧情计划')
    return
  }
  generateWizardStep.value = Math.min(generateWizardStep.value + 1, 5)
  if (generateWizardStep.value === 4) {
    generationContextReady.value = false
    await nextTick()
    await generationContextPreviewRef.value?.fetchPreview()
  }
}

async function ensureGenerationContextReady() {
  if (generationContextReady.value) return true
  generationContextReady.value = false
  refreshingGenerationContext.value = true
  try {
    await nextTick()
    await generationContextPreviewRef.value?.fetchPreview()
    return generationContextReady.value
  } finally {
    refreshingGenerationContext.value = false
  }
}

function prevGenerateWizardStep() {
  generateWizardStep.value = Math.max(generateWizardStep.value - 1, 1)
}

function splitPlanLines(value: string) {
  return value
    .split(/\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function joinPlanText(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .join('\n')
  }
  return typeof value === 'string' ? value.trim() : ''
}

function buildEditableChapterPlan() {
  return {
    goal: chapterPlanForm.goal.trim(),
    conflict: chapterPlanForm.conflict.trim(),
    turningPoint: chapterPlanForm.turningPoint.trim(),
    beats: splitPlanLines(chapterPlanForm.beats),
    mustInclude: splitPlanLines(chapterPlanForm.mustInclude),
    avoid: splitPlanLines(chapterPlanForm.avoid),
    characters: Array.from(selectedCharacterIds.value),
    characterStateDeltas: [],
    plotThreadActions: [],
    foreshadowingActions: [],
    interestHooks: splitPlanLines(chapterPlanForm.interestHooks),
    continuityRisks: [],
    pacing: chapterPlanForm.pacing.trim(),
    protocol: chapterPlanForm.protocol.trim()
  }
}

function resetAcceptedChapterPlan() {
  acceptedWorkflowPlanId.value = null
}

async function generateSingleChapterOutline() {
  if (!chapter.value) return
  generatingChapterOutline.value = true
  try {
    const description = await consumeSSEStream({
      url: '/api/ai/generate-chapter-outline',
      body: {
        novelId: novelId.value,
        chapterId: chapter.value.id,
        idea:
          outlineIdea.value.trim() ||
          chapterOutlineDraft.value.trim() ||
          `请按小说设定规划第 ${chapter.value.chapterNumber} 章`,
        currentOutline: chapterOutlineDraft.value.trim() || undefined,
        existingOutlines: sortedNovelOutlines.value.map((outline) => ({
          chapterNumber: outline.chapterNumber,
          description: outline.description
        })),
        aiConfigId: selectedAiConfigId.value
      }
    })
    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      message.warning('AI 未返回有效大纲文本')
      return
    }
    chapterOutlineDraft.value = trimmedDescription
    applyRecommendedCharacters()
  } catch (error: unknown) {
    message.error(getErrorMessage(error))
  } finally {
    generatingChapterOutline.value = false
  }
}

async function saveCurrentChapterOutline() {
  const outline = chapterOutlineDraft.value.trim()
  if (!chapter.value || !outline) {
    message.warning('请先确认本章大纲')
    return
  }
  savingChapterOutline.value = true
  try {
    const chapterNumber = chapter.value.chapterNumber
    const merged = [
      ...sortedNovelOutlines.value.filter(
        (item) => item.chapterNumber !== chapterNumber
      ),
      {
        id: currentChapterOutline.value?.id || 0,
        chapterNumber,
        description: outline,
        sortOrder: chapterNumber
      }
    ]
      .sort((left, right) => left.chapterNumber - right.chapterNumber)
      .map((item, index) => ({
        chapterNumber: item.chapterNumber,
        description: item.description,
        sortOrder: index
      }))
    await $fetch(`/api/novels/${novelId.value}/outlines`, {
      method: 'PUT',
      body: { outlines: merged }
    })
    await refreshNovelOutlines()
    message.success('本章大纲已保存')
  } catch (error: unknown) {
    message.error(getErrorMessage(error))
  } finally {
    savingChapterOutline.value = false
  }
}

async function generateChapterPlan() {
  const outline = chapterOutlineDraft.value.trim()
  if (!outline) {
    message.warning('请先确认本章大纲')
    return
  }
  generatingChapterPlan.value = true
  currentWorkflowPlanId.value = null
  acceptedWorkflowPlanId.value = null
  chapterPlanIssues.value = []
  chapterPlanBlocked.value = false
  try {
    for (const { field, label } of chapterPlanGenerationFields) {
      const response = await $fetch<ChapterPlanFieldResponse>(
        '/api/ai/generate-chapter-plan-field',
        {
          method: 'POST',
          body: {
            novelId: novelId.value,
            chapterId: chapterId.value,
            chapterOutline: outline,
            field,
            characterIds: Array.from(selectedCharacterIds.value),
            existingPlan: { ...chapterPlanForm },
            aiConfigId: selectedAiConfigId.value
          }
        }
      )
      chapterPlanForm[response.field] = joinPlanText(response.value)
      message.info(`${label}已生成`)
    }

    const response = await $fetch<ChapterPlanResponse>(
      '/api/ai/save-chapter-plan',
      {
        method: 'POST',
        body: {
          novelId: novelId.value,
          chapterId: chapterId.value,
          plan: buildEditableChapterPlan()
        }
      }
    )
    const plan = response.plan || {}
    chapterPlanForm.goal = joinPlanText(plan.goal)
    chapterPlanForm.conflict = joinPlanText(plan.conflict)
    chapterPlanForm.turningPoint = joinPlanText(plan.turningPoint)
    chapterPlanForm.beats = joinPlanText(plan.beats)
    chapterPlanForm.mustInclude = joinPlanText(plan.mustInclude)
    chapterPlanForm.avoid = joinPlanText(plan.avoid)
    chapterPlanForm.interestHooks = joinPlanText(plan.interestHooks)
    chapterPlanForm.pacing = joinPlanText(plan.pacing)
    chapterPlanForm.protocol = joinPlanText(plan.protocol)
    currentWorkflowPlanId.value = response.planId
    acceptedWorkflowPlanId.value =
      response.status === 'accepted' ? response.planId : null
    chapterPlanIssues.value = response.validation.issues
    chapterPlanBlocked.value = response.validation.blocked
    if (response.validation.blocked) {
      message.warning('剧情计划存在阻断问题，请修订后再验收')
    } else if (response.validation.issues.length) {
      message.warning('剧情计划已生成，但有可改进项，请确认后验收')
    } else {
      message.success('已生成大致剧情计划，请验收后继续')
    }
  } catch (error: unknown) {
    message.error(getErrorMessage(error))
  } finally {
    generatingChapterPlan.value = false
  }
}

async function acceptCurrentChapterPlan() {
  if (!currentWorkflowPlanId.value) {
    message.warning('请先生成大致剧情计划')
    return
  }
  const editablePlan = buildEditableChapterPlan()
  if (
    !editablePlan.goal ||
    !editablePlan.conflict ||
    !editablePlan.turningPoint
  ) {
    message.warning('请补全本章目标、核心冲突和关键转折')
    return
  }
  if (!editablePlan.beats.length) {
    message.warning('请至少填写一个剧情节拍')
    return
  }
  acceptingChapterPlan.value = true
  try {
    const response = await $fetch<{
      planId: number
      status: 'accepted'
      plan: Partial<ChapterPlanForm>
    }>('/api/ai/accept-chapter-plan', {
      method: 'POST',
      body: {
        novelId: novelId.value,
        chapterId: chapterId.value,
        planId: currentWorkflowPlanId.value,
        plan: editablePlan
      }
    })
    acceptedWorkflowPlanId.value = response.planId
    chapterPlanIssues.value = []
    chapterPlanBlocked.value = false
    message.success('剧情计划已验收')
  } catch (error: unknown) {
    acceptedWorkflowPlanId.value = null
    message.error(getErrorMessage(error))
  } finally {
    acceptingChapterPlan.value = false
  }
}

// 一致性检查是后台异步任务，保存/生成后分几个时间点重试刷新结果（替代写死的单次延时）
let consistencyRefreshTimers: ReturnType<typeof setTimeout>[] = []
function scheduleConsistencyRefresh() {
  for (const t of consistencyRefreshTimers) clearTimeout(t)
  consistencyRefreshTimers = [5000, 12000, 20000].map((delay) =>
    setTimeout(() => consistencyWarningsRef.value?.refresh(), delay)
  )
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null

watch(content, () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(autoSave, 3000)
})

async function autoSave() {
  if (content.value === chapter.value?.content) return
  if (!content.value?.trim() && !chapter.value?.content?.trim()) return
  await saveContent()
}

async function saveContent(source?: 'ai_generated' | 'user_edited') {
  saving.value = true
  try {
    const body: {
      content: string
      expectedUpdatedAt?: string
      source?: 'ai_generated' | 'user_edited'
    } = {
      content: content.value,
      expectedUpdatedAt: serverUpdatedAt.value || undefined
    }
    if (source) body.source = source
    const result = await $fetch<ChapterUpdateResult>(
      `/api/novels/${novelId.value}/chapters/${chapterId.value}`,
      {
        method: 'PUT',
        body
      }
    )
    lastSaved.value = new Date()
    serverUpdatedAt.value = result.updatedAt || lastSaved.value.toISOString()
    if (chapter.value) {
      chapter.value = {
        ...chapter.value,
        ...result,
        content: content.value,
        updatedAt: serverUpdatedAt.value
      }
    }
    syncCurrentChapterListItem(result)
    conflictDetected.value = false
    // 内容已保存 → 后端异步入队一致性检查，安排刷新以拉取结果
    scheduleConsistencyRefresh()
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 409
    ) {
      conflictDetected.value = true
      await refreshChapter()
      serverUpdatedAt.value = chapter.value?.updatedAt || null
    }
  } finally {
    saving.value = false
  }
}

function startEditTitle() {
  editTitleValue.value = chapter.value?.title || ''
  editingChapterTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function cancelEditTitle() {
  editingChapterTitle.value = false
}

async function finishEditTitle() {
  const newTitle = editTitleValue.value.trim()
  if (!newTitle || newTitle === chapter.value?.title) {
    editingChapterTitle.value = false
    return
  }
  try {
    await $fetch(`/api/novels/${novelId.value}/chapters/${chapterId.value}`, {
      method: 'PUT',
      body: { title: newTitle }
    })
    await Promise.all([refreshChapter(), refreshAllChapters()])
  } catch {}
  editingChapterTitle.value = false
}

const regeneratingTitle = ref(false)
const suggestedTitle = ref('')
const showTitleSuggestion = ref(false)
const titleSuggestionUsage = ref<AiTitleUsage | null>(null)

async function aiRegenerateCurrentTitle() {
  if (regeneratingTitle.value) return
  regeneratingTitle.value = true
  suggestedTitle.value = ''
  titleSuggestionUsage.value = null
  showTitleSuggestion.value = true
  try {
    const result = await $fetch<{ title: string; usage?: AiTitleUsage }>(
      '/api/ai/suggest-title',
      {
        method: 'POST',
        body: {
          novelId: novelId.value,
          chapterId: chapterId.value,
          aiConfigId: selectedAiConfigId.value
        }
      }
    )
    const cleaned = cleanAiChapterTitle(result.title)
    if (cleaned) {
      suggestedTitle.value = cleaned
      titleSuggestionUsage.value = result.usage || null
    } else {
      showTitleSuggestion.value = false
      message.warning('AI 未能生成有效标题')
    }
  } catch {
    showTitleSuggestion.value = false
    message.error('生成章节名失败')
  } finally {
    regeneratingTitle.value = false
  }
}

async function applyTitleSuggestion() {
  if (!suggestedTitle.value) return
  try {
    await $fetch(`/api/novels/${novelId.value}/chapters/${chapterId.value}`, {
      method: 'PUT',
      body: { title: suggestedTitle.value }
    })
    await Promise.all([refreshChapter(), refreshAllChapters()])
    message.success(`标题已更新为「${suggestedTitle.value}」`)
  } catch {}
  showTitleSuggestion.value = false
  suggestedTitle.value = ''
  titleSuggestionUsage.value = null
}

function discardTitleSuggestion() {
  showTitleSuggestion.value = false
  suggestedTitle.value = ''
  titleSuggestionUsage.value = null
}

function handleTextSelect() {
  // Don't clear selection during AI action — applyAiResult needs it
  if (expandingOrRewriting.value) return
  const selected = getEditorSelectionText()
  if (selected && selected.trim().length > 0) {
    selectedText.value = selected
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      floatingToolbarPos.x = rect.left + rect.width / 2
      floatingToolbarPos.y = rect.top - 10
      showFloatingToolbar.value = true
    }
  } else {
    selectedText.value = ''
    showFloatingToolbar.value = false
  }
}

function onEditorMousedown(e: MouseEvent) {
  if (expandingOrRewriting.value && savedEditorSelection.value) {
    e.preventDefault()
  }
}

function onDocumentMousedown(e: MouseEvent) {
  // Preserve editor selection highlight during AI action
  if (expandingOrRewriting.value && savedEditorSelection.value) {
    // Allow clicks on the result panel buttons (apply/discard)
    const target = e.target as HTMLElement
    if (target.closest('.ai-result-panel')) return
    e.preventDefault()
  }
}

async function doAiAction(
  type: 'expand' | 'rewrite' | 'continue',
  direction?: string
) {
  if (!aiStatus.value.available) {
    aiActionResult.value =
      aiStatus.value.reason || 'AI 当前不可用，仍可手动写作'
    aiActionType.value = type
    return
  }
  showFloatingToolbar.value = false
  expandingOrRewriting.value = true
  aiActionResult.value = ''
  aiActionType.value = type
  savedEditorSelection.value = getEditorSelectionRange()
  document.addEventListener('mousedown', onDocumentMousedown, true)

  const controller = new AbortController()
  activeAbortController = controller
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const body: Record<string, unknown> = {
      novelId: novelId.value,
      chapterId: chapterId.value,
      aiConfigId: selectedAiConfigId.value
    }
    if (type === 'continue') {
      body.contextBefore = getContextBeforeCursor()
      if (direction) body.direction = direction
    } else {
      body.selectedText = selectedText.value
    }

    const response = await fetch(`/api/ai/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `AI 请求失败：${response.status}${errorBody ? ` - ${errorBody}` : ''}`
      )
    }
    if (!response.body) {
      throw new Error('AI 响应为空')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      let streamDone = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        try {
          const data = JSON.parse(trimmed.slice(6)) as AiStreamPayload
          if (data.error) throw new Error(data.error)
          if (data.content) aiActionResult.value += data.content
          if (data.done) {
            streamDone = true
            break
          }
        } catch (error: unknown) {
          if (error instanceof SyntaxError) continue
          throw new Error(getErrorMessage(error))
        }
      }
      if (streamDone) {
        reader.cancel()
        break
      }
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (!aiActionResult.value) {
        aiActionResult.value = '请求超时，请重试'
      }
    } else {
      aiActionResult.value = getErrorMessage(error)
    }
  } finally {
    clearTimeout(timeout)
    expandingOrRewriting.value = false
    savedEditorSelection.value = null
    document.removeEventListener('mousedown', onDocumentMousedown, true)
    activeAbortController = null
  }
}

const showFragmentMenu = ref(false)

async function doFragment(
  type: 'dialogue' | 'description' | 'action' | 'monologue'
) {
  if (!aiStatus.value.available) {
    aiActionResult.value =
      aiStatus.value.reason || 'AI 当前不可用，仍可手动写作'
    aiActionType.value = 'continue'
    return
  }
  showFloatingToolbar.value = false
  showFragmentMenu.value = false
  expandingOrRewriting.value = true
  aiActionResult.value = ''
  aiActionType.value = 'continue'

  const controller = new AbortController()
  activeAbortController = controller
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch('/api/ai/fragment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: novelId.value,
        chapterId: chapterId.value,
        type,
        contextBefore: getContextBeforeCursor(),
        aiConfigId: selectedAiConfigId.value
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`AI 请求失败：${response.status}`)
    }
    if (!response.body) {
      throw new Error('AI 响应为空')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      let streamDone = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        try {
          const data = JSON.parse(trimmed.slice(6)) as AiStreamPayload
          if (data.error) throw new Error(data.error)
          if (data.content) aiActionResult.value += data.content
          if (data.done) {
            streamDone = true
            break
          }
        } catch (error: unknown) {
          if (error instanceof SyntaxError) continue
          throw new Error(getErrorMessage(error))
        }
      }
      if (streamDone) {
        reader.cancel()
        break
      }
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (!aiActionResult.value) {
        aiActionResult.value = '请求超时，请重试'
      }
    } else {
      aiActionResult.value = getErrorMessage(error)
    }
  } finally {
    clearTimeout(timeout)
    expandingOrRewriting.value = false
    activeAbortController = null
  }
}

const trackChangesDiff = computed<DiffLine[]>(() => {
  if (
    aiActionType.value !== 'rewrite' ||
    !selectedText.value ||
    !aiActionResult.value
  )
    return []
  return computeLineDiff(selectedText.value, aiActionResult.value)
})

function applyAiResult() {
  if (!aiActionResult.value) return
  if (aiActionType.value === 'continue' && selectedText.value) {
    replaceEditorSelection(aiActionResult.value)
  } else if (aiActionType.value === 'continue') {
    insertEditorTextAtCursor(aiActionResult.value)
  } else if (aiActionType.value === 'expand' && selectedText.value) {
    replaceEditorSelection(aiActionResult.value)
  } else if (selectedText.value) {
    replaceEditorSelection(aiActionResult.value)
  }
  aiActionResult.value = ''
  aiActionType.value = null
  saveContent()
  clearDraftRecovery()
}

function discardAiResult() {
  aiActionResult.value = ''
  aiActionType.value = null
  clearDraftRecovery()
}

async function loadLatestChapter() {
  await refreshChapter()
  content.value = chapter.value?.content || ''
  await setEditorMarkdown(content.value)
  conflictDetected.value = false
}

function forceSaveContent() {
  serverUpdatedAt.value = null
  saveContent()
}

async function generateChapter() {
  if (!selectedAiConfigId.value) return
  if (!chapterOutlineDraft.value.trim()) {
    message.warning('请先确认本章大纲')
    return
  }
  if (!aiActionAvailable.value) {
    message.warning(aiStatus.value.reason || 'AI 当前不可用，请检查模型配置')
    return
  }
  const contextReady = await ensureGenerationContextReady()
  if (!contextReady) {
    message.warning('上下文仍在刷新，请稍后再试')
    return
  }

  const finalDirection = buildFinalGenerateDirection()

  generating.value = true
  generatedContent.value = ''
  showGenerateDialog.value = false

  const controller = new AbortController()
  activeAbortController = controller
  const timeout = setTimeout(() => {
    controller.abort()
  }, 180000)

  let contentBuffer = ''
  let rafId: number | null = null

  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: novelId.value,
        chapterId: chapterId.value,
        chapterOutline: chapterOutlineDraft.value.trim() || undefined,
        direction: finalDirection || undefined,
        aiConfigId: selectedAiConfigId.value,
        workflowPlanId: acceptedWorkflowPlanId.value || undefined,
        ...(generationSamplingLocked.value ?
          {}
        : {
            temperature: generateTemperature.value,
            topP: generateTopP.value
          }),
        thinkingEnabled: generateThinkingEnabled.value ?? undefined,
        reasoningEffort: generateReasoningEffort.value ?? undefined,
        maxTokens: generateMaxTokens.value,
        skillIds: selectedSkillIds.value,
        contextSelection: generationContextSelection.value || undefined
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `AI 请求失败：${response.status}${errorBody ? ` - ${errorBody}` : ''}`
      )
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let lineBuffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        try {
          const data = JSON.parse(trimmed.slice(6))
          if (data.content) {
            contentBuffer += data.content
            if (!rafId) {
              rafId = requestAnimationFrame(() => {
                generatedContent.value = contentBuffer
                rafId = null
              })
            }
          }
          if (data.done) {
            if (rafId) {
              cancelAnimationFrame(rafId)
              rafId = null
            }
            generatedContent.value = contentBuffer
            previousGeneratedContent.value = contentBuffer
            await setEditorMarkdown(contentBuffer)
            content.value = contentBuffer
            await saveContent('ai_generated')
            await refreshChapter()
            clearDraftRecovery()
            scheduleConsistencyRefresh()
            reader.cancel()
            return
          }
        } catch {}
      }
    }
  } catch (e: unknown) {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (contentBuffer) generatedContent.value = contentBuffer
    if (e instanceof DOMException && e.name === 'AbortError') {
      if (generatedContent.value) {
        previousGeneratedContent.value = generatedContent.value
        await setEditorMarkdown(generatedContent.value)
        content.value = generatedContent.value
        saveDraftRecovery(generatedContent.value, 'generate')
        message.info('生成超时，已保留已生成的内容')
      }
    }
  } finally {
    clearTimeout(timeout)
    generating.value = false
    activeAbortController = null
  }
}

async function regenerateWithFeedback() {
  if (!feedbackText.value.trim() || !previousGeneratedContent.value) return

  regenerating.value = true
  generatedContent.value = ''

  const controller = new AbortController()
  activeAbortController = controller
  const timeout = setTimeout(() => {
    controller.abort()
  }, 180000)

  let contentBuffer = ''
  let rafId: number | null = null

  try {
    const response = await fetch('/api/ai/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: novelId.value,
        chapterId: chapterId.value,
        previousResult: previousGeneratedContent.value,
        feedback: feedbackText.value,
        aiConfigId: selectedAiConfigId.value,
        ...(generationSamplingLocked.value ?
          {}
        : {
            temperature: generateTemperature.value,
            topP: generateTopP.value
          }),
        thinkingEnabled: generateThinkingEnabled.value ?? undefined,
        reasoningEffort: generateReasoningEffort.value ?? undefined,
        maxTokens: generateMaxTokens.value
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `AI 请求失败：${response.status}${errorBody ? ` - ${errorBody}` : ''}`
      )
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let lineBuffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        try {
          const data = JSON.parse(trimmed.slice(6))
          if (data.content) {
            contentBuffer += data.content
            if (!rafId) {
              rafId = requestAnimationFrame(() => {
                generatedContent.value = contentBuffer
                rafId = null
              })
            }
          }
          if (data.done) {
            if (rafId) {
              cancelAnimationFrame(rafId)
              rafId = null
            }
            generatedContent.value = contentBuffer
            previousGeneratedContent.value = contentBuffer
            await setEditorMarkdown(contentBuffer)
            content.value = contentBuffer
            await saveContent('ai_generated')
            await refreshChapter()
            showFeedbackInput.value = false
            feedbackText.value = ''
            reader.cancel()
            return
          }
        } catch {}
      }
    }
  } catch (e: unknown) {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (contentBuffer) generatedContent.value = contentBuffer
    if (e instanceof DOMException && e.name === 'AbortError') {
      if (generatedContent.value) {
        previousGeneratedContent.value = generatedContent.value
        await setEditorMarkdown(generatedContent.value)
        content.value = generatedContent.value
        saveDraftRecovery(generatedContent.value, 'generate')
        message.info('生成超时，已保留已生成的内容')
      }
    }
  } finally {
    clearTimeout(timeout)
    regenerating.value = false
    activeAbortController = null
  }
}

function cancelFeedbackRegeneration() {
  showFeedbackInput.value = false
  feedbackText.value = ''
}

function clearAllSuggestions() {
  rejectAllSuggestions()
  clearSuggestions()
}

function viewVersionDiff(version: ChapterVersionItem) {
  diffVersion.value = version
  const current = content.value || ''
  diffLines.value = computeLineDiff(version.content, current)
  showVersionDiff.value = true
}

async function rollbackVersion(version: ChapterVersionItem) {
  rollingBack.value = true
  try {
    await $fetch(
      `/api/novels/${novelId.value}/chapters/${chapterId.value}/versions/${version.id}/rollback`,
      { method: 'POST' }
    )
    await Promise.all([
      refreshChapter(),
      refreshVersions(),
      refreshAllChapters()
    ])
    content.value = version.content
    await setEditorMarkdown(version.content)
  } finally {
    rollingBack.value = false
  }
}

function undoVersion(version: ChapterVersionItem) {
  dialog.warning({
    title: '直接撤销',
    content: `确定直接撤销到 V${version.versionNumber} 吗？此操作不会生成新版本记录，也不会保留当前内容备份。`,
    positiveText: '直接撤销',
    negativeText: '取消',
    onPositiveClick: async () => {
      undoingVersionId.value = version.id
      try {
        await $fetch(
          `/api/novels/${novelId.value}/chapters/${chapterId.value}/versions/${version.id}/undo`,
          { method: 'POST' }
        )
        await Promise.all([
          refreshChapter(),
          refreshVersions(),
          refreshAllChapters()
        ])
        content.value = version.content
        await setEditorMarkdown(version.content)
        showVersionDiff.value = false
        message.success(`已直接撤销到 V${version.versionNumber}`)
      } catch {
        message.error('直接撤销失败，请稍后重试')
      } finally {
        undoingVersionId.value = null
      }
    }
  })
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

function getShortcutMap() {
  const defaults: Record<string, string> = {
    help: 'Ctrl + /',
    save: 'Ctrl + S',
    generate: 'Ctrl + G',
    search: 'Ctrl + K',
    zen: 'Ctrl + Shift + Z',
    expand: 'Ctrl + E',
    continue: 'Ctrl + J'
  }
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem('chapter_editor_shortcuts') || '{}')
    }
  } catch {
    return defaults
  }
}

function normalizePressedShortcut(e: KeyboardEvent) {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  if (!['Control', 'Meta', 'Shift', 'Alt'].includes(key)) parts.push(key)
  return parts.join(' + ')
}

function isShortcut(e: KeyboardEvent, action: string) {
  return normalizePressedShortcut(e) === getShortcutMap()[action]
}

function handleDocumentKeydown(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey)) return

  if (isShortcut(e, 'help')) {
    e.preventDefault()
    showShortcutHelp.value = !showShortcutHelp.value
    return
  }

  if (isShortcut(e, 'save')) {
    e.preventDefault()
    saveContent()
    return
  }

  if (isShortcut(e, 'zen')) {
    e.preventDefault()
    zenMode.value = !zenMode.value
    return
  }

  if (isEditableShortcutTarget(e.target)) return

  if (isShortcut(e, 'search')) {
    e.preventDefault()
    sidebarCollapsed.value = false
    leftSidebarTab.value = 'chapters'
    nextTick(() => chapterListRef.value?.querySelector('input')?.focus())
    return
  }

  if (isShortcut(e, 'generate')) {
    e.preventDefault()
    if (!generating.value && aiStatus.value.available) {
      showGenerateDialog.value = true
    }
    return
  }

  if (isShortcut(e, 'expand')) {
    e.preventDefault()
    const selection = getEditorSelectionText() || ''
    if (selection.trim()) {
      selectedText.value = selection
      doAiAction('expand')
    }
    return
  }

  if (isShortcut(e, 'continue')) {
    e.preventDefault()
    if (!(getEditorSelectionText() || '').trim()) {
      doAiAction('continue')
    }
  }
}

/* ─────────────── 写作安全 ─────────────── */
const hasUnsavedChanges = computed(() => {
  if (saving.value) return false
  return (content.value || '') !== (chapter.value?.content || '')
})

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

function updatePageHeight() {
  const isMobile = window.innerWidth < 1024
  if (isMobile) {
    pageHeight.value = `calc(100dvh - 10rem)`
    return
  }
  const contentSlot = pageRootRef.value?.parentElement?.parentElement
  if (!contentSlot) return
  const style = getComputedStyle(contentSlot)
  const verticalPadding =
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
  pageHeight.value = `${contentSlot.clientHeight - verticalPadding}px`
}

onMounted(() => {
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('beforeunload', handleBeforeUnload)
  nextTick(() => {
    updatePageHeight()
    const contentSlot = pageRootRef.value?.parentElement?.parentElement
    if (!contentSlot) return
    pageResizeObserver = new ResizeObserver(updatePageHeight)
    pageResizeObserver.observe(contentSlot)
  })
})

onBeforeRouteLeave(async () => {
  if (hasUnsavedChanges.value) {
    await saveContent()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  pageResizeObserver?.disconnect()
  if (saveTimeout) clearTimeout(saveTimeout)
  if (detectTimeout) clearTimeout(detectTimeout)
})
</script>

<template>
  <div
    ref="pageRootRef"
    class="chapter-editor-shell flex flex-col overflow-hidden transition-all duration-300"
    :class="{ 'fixed inset-0 z-50': zenMode }"
    :style="{ height: zenMode ? '100vh' : pageHeight }"
  >
    <!-- Toolbar -->
    <div
      v-if="!zenMode"
      class="flex h-12 shrink-0 items-center gap-2.5 border-b border-sky-100/80 bg-white/86 px-4 shadow-[0_12px_34px_-28px_rgba(14,116,144,0.65)] backdrop-blur-md dark:border-sky-900/45 dark:bg-slate-950/76"
    >
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg text-sky-600 transition-colors hover:bg-sky-50 hover:text-sky-700 dark:text-sky-300 dark:hover:bg-sky-950/70 dark:hover:text-sky-200"
        @click="navigateTo(getNovelTo())"
      >
        <Icon
          icon="lucide:arrow-left"
          class="w-4 h-4"
        />
      </button>
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <NButton
          v-if="prevChapter"
          size="tiny"
          quaternary
          :title="`上一章：${prevChapter.title}`"
          @click="goToChapter(prevChapter.id)"
        >
          <template #icon
            ><Icon
              icon="lucide:chevron-left"
              class="w-4 h-4"
          /></template>
        </NButton>
        <div class="min-w-0 flex-1">
          <div
            v-if="!editingChapterTitle"
            class="flex items-center gap-1 min-w-0"
          >
            <div
              class="flex items-center gap-1 min-w-0 cursor-pointer group"
              title="点击修改章节名"
              @click="startEditTitle"
            >
              <p
                class="truncate text-sm font-medium text-slate-800 transition-colors group-hover:text-sky-600 dark:text-slate-100 dark:group-hover:text-sky-300"
              >
                Ch.{{ chapter?.chapterNumber }} {{ chapter?.title }}
              </p>
              <Icon
                icon="lucide:pencil"
                class="h-3 w-3 shrink-0 text-sky-300 transition-colors group-hover:text-sky-500 dark:text-sky-700 dark:group-hover:text-sky-300"
              />
            </div>
            <button
              type="button"
              class="ml-1 shrink-0 rounded p-0.5 text-sky-400 transition-colors hover:text-sky-600 dark:text-sky-600 dark:hover:text-sky-300"
              :class="{ 'animate-spin': regeneratingTitle }"
              title="AI 生成章节名"
              :disabled="regeneratingTitle"
              @click.stop="aiRegenerateCurrentTitle"
            >
              <Icon
                icon="lucide:sparkles"
                class="w-3.5 h-3.5"
              />
            </button>
          </div>
          <input
            v-else
            ref="titleInputRef"
            v-model="editTitleValue"
            class="w-full text-sm font-medium bg-transparent border-b border-(--ui-primary) outline-none text-(--ui-text-highlighted) py-0.5"
            @blur="finishEditTitle"
            @keydown.enter="finishEditTitle"
            @keydown.escape="cancelEditTitle"
          />
        </div>
        <NButton
          v-if="nextChapter"
          size="tiny"
          quaternary
          :title="`下一章：${nextChapter.title}`"
          @click="goToChapter(nextChapter.id)"
        >
          <template #icon
            ><Icon
              icon="lucide:chevron-right"
              class="w-4 h-4"
          /></template>
        </NButton>
      </div>

      <!-- Left group: AI model + features -->
      <div class="flex items-center gap-1">
        <div
          v-if="!aiActionAvailable"
          class="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600"
          title="AI 当前不可用，仍可手动写作"
        >
          <Icon
            v-if="!isRefreshing"
            icon="lucide:wifi-off"
            class="w-3 h-3"
          />
          <Icon
            v-else
            icon="lucide:loader-2"
            class="w-3 h-3 animate-spin"
          />
          {{ isRefreshing ? '检测中...' : 'AI 离线' }}
          <button
            class="text-[11px] underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
            :disabled="isRefreshing"
            @click="() => retryAiStatus()"
          >
            重试
          </button>
        </div>
        <NPopselect
          v-model:value="selectedAiConfigId"
          :options="generationModelOptions"
          trigger="click"
          size="small"
        >
          <button
            class="flex h-9 min-w-0 max-w-56 items-center gap-2 rounded-lg border border-sky-100/80 bg-sky-50/70 px-2.5 text-left text-[11px] text-sky-700 transition-colors hover:border-sky-200 hover:bg-white dark:border-sky-900/50 dark:bg-sky-950/45 dark:text-sky-200 dark:hover:bg-sky-950/75"
            :title="selectedGenerationConfigMeta"
          >
            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-sky-500 shadow-sm dark:bg-sky-950/70 dark:text-sky-300"
            >
              <Icon
                icon="lucide:wand-sparkles"
                class="h-3.5 w-3.5"
              />
            </span>
            <span class="min-w-0 leading-tight">
              <span
                class="block text-[9px] font-medium text-sky-500 dark:text-sky-400"
              >
                {{ selectedGenerationConfigBadge }}
              </span>
              <span
                class="block truncate text-[11px] font-semibold text-sky-800 dark:text-sky-100"
              >
                {{ selectedGenerationConfigTitle }}
              </span>
            </span>
          </button>
        </NPopselect>
        <button
          class="flex h-9 items-center gap-2 rounded-lg border border-cyan-100/80 bg-cyan-50/60 px-2.5 text-left text-[11px] text-cyan-700 transition-colors hover:border-cyan-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 dark:border-cyan-900/50 dark:bg-cyan-950/35 dark:text-cyan-200 dark:hover:bg-cyan-950/60"
          :disabled="generationSamplingLocked"
          :title="`${generationSamplingHint}；${selectedGenerationConfigMeta}`"
          @click="cyclePreset"
        >
          <Icon
            icon="lucide:thermometer"
            class="h-3.5 w-3.5 shrink-0"
          />
          <span class="leading-tight">
            <span
              class="block text-[9px] font-medium text-cyan-500 dark:text-cyan-400"
            >
              采样
            </span>
            <span
              class="block whitespace-nowrap text-[11px] font-semibold text-cyan-800 dark:text-cyan-100"
            >
              {{ samplingSummaryLabel }}
            </span>
          </span>
        </button>
        <div class="mx-0.5 h-4 w-px bg-sky-100 dark:bg-sky-900/60" />
        <button
          type="button"
          class="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-45 dark:text-sky-400 dark:hover:bg-sky-950/70 dark:hover:text-sky-200"
          :disabled="!aiActionAvailable || !content"
          title="AI 建议"
          @click="startSuggestionMode"
        >
          <Icon
            :icon="
              suggestionsLoading ? 'lucide:loader-2' : (
                'lucide:message-square-diff'
              )
            "
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': suggestionsLoading }"
          />
          <span class="hidden xl:inline">建议</span>
        </button>
        <button
          type="button"
          class="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-45 dark:text-sky-400 dark:hover:bg-sky-950/70 dark:hover:text-sky-200"
          :disabled="!aiActionAvailable"
          title="AI 生成"
          @click="openGenerateWizard"
        >
          <Icon
            :icon="generating ? 'lucide:loader-2' : 'lucide:sparkles'"
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': generating }"
          />
          <span class="hidden xl:inline">生成</span>
        </button>
      </div>

      <div class="h-4 w-px bg-sky-100 dark:bg-sky-900/60" />

      <!-- Right group: Utility actions -->
      <div class="flex items-center gap-1">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/70 dark:hover:text-sky-200"
          title="快捷键（Ctrl + /）"
          @click="showShortcutHelp = true"
        >
          <Icon
            icon="lucide:keyboard"
            class="w-3.5 h-3.5"
          />
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/70 dark:hover:text-sky-200"
          title="禅模式"
          @click="zenMode = true"
        >
          <Icon
            icon="lucide:maximize"
            class="w-3.5 h-3.5"
          />
        </button>
        <NButton
          size="tiny"
          type="primary"
          :loading="saving"
          @click="() => saveContent()"
        >
          <template #icon>
            <Icon icon="lucide:save" />
          </template>
        </NButton>
      </div>
    </div>

    <!-- Zen Mode Controls -->
    <div
      v-if="zenMode"
      class="absolute top-4 right-4 z-10 flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity duration-300"
    >
      <div
        class="flex items-center gap-1.5 card-glass rounded-xl px-2.5 py-1.5"
      >
        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
          @click="zenFontSize = Math.max(12, zenFontSize - 2)"
        >
          <Icon
            icon="lucide:minus"
            class="w-3.5 h-3.5"
          />
        </button>
        <span
          class="text-xs font-mono text-(--ui-text-muted) w-6 text-center"
          >{{ zenFontSize }}</span
        >
        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
          @click="zenFontSize = Math.min(32, zenFontSize + 2)"
        >
          <Icon
            icon="lucide:plus"
            class="w-3.5 h-3.5"
          />
        </button>
        <div class="w-px h-4 bg-(--ui-border)/50 mx-1" />
        <button
          class="flex items-center justify-center h-7 px-2 rounded-lg text-xs text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
          @click="
            zenFontFamily =
              zenFontFamily === 'serif' ? 'sans-serif'
              : zenFontFamily === 'sans-serif' ? 'monospace'
              : 'serif'
          "
        >
          {{
            zenFontFamily === 'serif' ? '衬线'
            : zenFontFamily === 'sans-serif' ? '无衬线'
            : '等宽'
          }}
        </button>
      </div>
      <button
        class="flex items-center justify-center w-9 h-9 rounded-xl card-glass text-(--ui-text-muted) hover:text-(--ui-text) transition-colors"
        title="退出禅模式 (Ctrl+Shift+Z)"
        @click="zenMode = false"
      >
        <Icon
          icon="lucide:minimize"
          class="w-4 h-4"
        />
      </button>
    </div>

    <!-- Zen Mode Bottom Bar -->
    <div
      v-if="zenMode"
      class="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3 text-[11px] text-(--ui-text-dimmed)"
    >
      <!-- Left: Status -->
      <div class="flex items-center gap-3">
        <span
          class="flex items-center gap-1"
          :class="saveStatusClass"
        >
          <Icon
            :icon="
              conflictDetected ? 'lucide:triangle-alert'
              : saving ? 'lucide:loader-circle'
              : 'lucide:check-circle'
            "
            class="size-3"
            :class="saving ? 'animate-spin' : ''"
          />
          {{ saveStatusText }}
        </span>
        <span class="tabular-nums"
          >{{ currentWordCount.toLocaleString() }} 字</span
        >
      </div>
      <!-- Center: AI actions -->
      <div class="flex items-center gap-1">
        <NPopselect
          v-model:value="selectedAiConfigId"
          :options="generationModelOptions"
          trigger="click"
          size="small"
        >
          <button
            class="flex items-center gap-1 h-7 px-2 rounded-md text-[11px] text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
            :title="selectedGenerationConfigMeta"
          >
            <Icon
              icon="lucide:wand-sparkles"
              class="w-3 h-3"
            />
            <span class="max-w-28 truncate">{{
              selectedGenerationConfigTitle
            }}</span>
          </button>
        </NPopselect>
        <button
          class="flex items-center gap-1 h-7 px-2 rounded-md text-[11px] text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          :disabled="generationSamplingLocked"
          :title="`${generationSamplingHint}；${selectedGenerationConfigMeta}`"
          @click="cyclePreset"
        >
          <Icon
            icon="lucide:thermometer"
            class="w-3 h-3"
          />
          <span>{{ samplingSummaryLabel }}</span>
        </button>
        <div class="w-px h-4 bg-(--ui-border)/30 mx-0.5" />
        <NButton
          size="tiny"
          quaternary
          :disabled="!aiActionAvailable"
          title="AI 续写 (Ctrl+J)"
          @click="doAiAction('continue')"
        >
          <template #icon><Icon icon="lucide:pen-line" /></template>
          续写
        </NButton>
        <NButton
          size="tiny"
          quaternary
          :loading="generating"
          :disabled="!aiActionAvailable"
          title="AI 生成"
          @click="openGenerateWizard"
        >
          <template #icon><Icon icon="lucide:sparkles" /></template>
          生成
        </NButton>
        <NButton
          size="tiny"
          quaternary
          :loading="saving"
          title="保存 (Ctrl+S)"
          @click="() => saveContent()"
        >
          <template #icon><Icon icon="lucide:save" /></template>
        </NButton>
      </div>
      <!-- Right: Progress -->
      <div class="flex items-center gap-2">
        <span class="tabular-nums"
          >{{ currentWordCount }} / {{ chapterGoal }}</span
        >
        <div
          class="relative w-16 h-1 rounded-full bg-(--ui-border)/30 overflow-hidden"
        >
          <div
            class="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            :class="
              chapterProgress >= 100 ? 'bg-emerald-400' : 'bg-(--ui-primary)/50'
            "
            :style="{ width: `${chapterProgress}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Draft Recovery -->
    <div
      v-if="draftRecovery"
      class="px-4 py-2.5 bg-sky-500/5 border-b border-sky-500/20 flex items-center justify-between shrink-0"
    >
      <div class="flex items-center gap-2">
        <span class="size-1.5 rounded-full bg-sky-400 animate-pulse" />
        <p class="text-xs text-sky-600 dark:text-sky-400">
          检测到未完成的 AI
          {{
            draftRecovery.type === 'generate' ? '生成'
            : draftRecovery.type === 'continue' ? '续写'
            : draftRecovery.type === 'expand' ? '扩写'
            : '改写'
          }}草稿，是否恢复？
        </p>
      </div>
      <div class="flex gap-1.5">
        <NButton
          size="tiny"
          type="primary"
          @click="applyDraftRecovery"
          >恢复</NButton
        >
        <NButton
          size="tiny"
          quaternary
          @click="clearDraftRecovery"
          >放弃</NButton
        >
      </div>
    </div>

    <!-- Conflict Warning -->
    <div
      v-if="conflictDetected"
      class="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/20 flex items-center justify-between shrink-0"
    >
      <div class="flex items-center gap-2">
        <span class="size-1.5 rounded-full bg-amber-400 animate-pulse" />
        <p class="text-xs text-amber-600 dark:text-amber-400">
          此章节已在其他地方被修改，保存可能覆盖更改。
        </p>
      </div>
      <div class="flex gap-1.5">
        <NButton
          size="tiny"
          secondary
          @click="loadLatestChapter"
          >加载最新</NButton
        >
        <NButton
          size="tiny"
          quaternary
          @click="forceSaveContent"
          >强制保存</NButton
        >
      </div>
    </div>

    <!-- Main Area: Sidebar + Editor -->
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Left Sidebar -->
      <div
        v-if="!zenMode"
        class="flex shrink-0 flex-col border-r border-sky-100/80 bg-[linear-gradient(180deg,rgba(239,248,255,0.96)_0%,rgba(225,242,255,0.9)_100%)] shadow-[18px_0_42px_-34px_rgba(14,116,144,0.78)] backdrop-blur transition-all duration-200 dark:border-sky-900/45 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82)_0%,rgba(8,28,48,0.74)_100%)]"
        :class="sidebarCollapsed ? 'w-10' : 'w-64'"
      >
        <!-- Collapse toggle -->
        <button
          class="flex h-8 items-center justify-center border-b border-sky-100/80 text-sky-500 transition-colors hover:bg-white/75 hover:text-sky-700 dark:border-sky-900/45 dark:text-sky-400 dark:hover:bg-sky-950/55 dark:hover:text-sky-200"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <Icon
            :icon="
              sidebarCollapsed ?
                'lucide:panel-right-open'
              : 'lucide:panel-left-close'
            "
            class="w-3.5 h-3.5"
          />
        </button>

        <template v-if="!sidebarCollapsed">
          <!-- 自定义 Tabs -->
          <div class="px-2 pt-2 pb-1">
            <div
              class="flex gap-0.5 rounded-lg border border-sky-100/80 bg-white/75 p-0.5 shadow-inner shadow-sky-100/50 dark:border-sky-900/45 dark:bg-slate-900/62 dark:shadow-none"
            >
              <button
                class="flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'chapters' ?
                    'bg-white text-sky-700 shadow-sm shadow-sky-100/80 dark:bg-sky-950/70 dark:text-sky-200 dark:shadow-none'
                  : 'text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200'
                "
                @click="leftSidebarTab = 'chapters'"
              >
                章节
              </button>
              <button
                class="flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'characters' ?
                    'bg-white text-sky-700 shadow-sm shadow-sky-100/80 dark:bg-sky-950/70 dark:text-sky-200 dark:shadow-none'
                  : 'text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200'
                "
                @click="leftSidebarTab = 'characters'"
              >
                角色
              </button>
              <button
                class="flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'versions' ?
                    'bg-white text-sky-700 shadow-sm shadow-sky-100/80 dark:bg-sky-950/70 dark:text-sky-200 dark:shadow-none'
                  : 'text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200'
                "
                @click="leftSidebarTab = 'versions'"
              >
                版本
              </button>
              <button
                class="flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'notes' ?
                    'bg-white text-sky-700 shadow-sm shadow-sky-100/80 dark:bg-sky-950/70 dark:text-sky-200 dark:shadow-none'
                  : 'text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200'
                "
                @click="leftSidebarTab = 'notes'"
              >
                笔记
              </button>
              <button
                class="relative rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'checks' ?
                    'bg-white text-sky-700 shadow-sm shadow-sky-100/80 dark:bg-sky-950/70 dark:text-sky-200 dark:shadow-none'
                  : 'text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-200'
                "
                @click="leftSidebarTab = 'checks'"
              >
                检查
              </button>
            </div>
          </div>

          <!-- Chapters Tab -->
          <div
            v-show="leftSidebarTab === 'chapters'"
            class="flex-1 min-h-0 flex flex-col"
          >
            <div class="px-2 pb-2 space-y-2">
              <div class="flex items-center gap-1.5">
                <NInput
                  v-model:value="chapterSearchQuery"
                  size="tiny"
                  clearable
                  placeholder="搜索章节"
                >
                  <template #prefix>
                    <Icon
                      icon="lucide:search"
                      class="w-3.5 h-3.5 text-(--ui-text-dimmed)"
                    />
                  </template>
                </NInput>
                <button
                  type="button"
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated)/70 hover:text-(--ui-text) transition-colors"
                  title="定位当前章节"
                  @click="locateCurrentChapter"
                >
                  <Icon
                    icon="lucide:locate-fixed"
                    class="w-3.5 h-3.5"
                  />
                </button>
                <button
                  type="button"
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--ui-text-dimmed) hover:bg-primary-50 hover:text-primary-500 transition-colors"
                  title="新建章节"
                  :disabled="creatingChapter"
                  @click="openNewChapterDialog"
                >
                  <Icon
                    icon="lucide:plus"
                    class="w-3.5 h-3.5"
                  />
                </button>
                <button
                  type="button"
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated)/70 hover:text-(--ui-text) transition-colors"
                  title="已删除的章节"
                  @click="showDeletedChapters = true"
                >
                  <Icon
                    icon="lucide:archive-restore"
                    class="w-3.5 h-3.5"
                  />
                </button>
              </div>
            </div>

            <div
              ref="chapterListRef"
              class="flex-1 overflow-y-auto px-2 pb-2 space-y-1"
            >
              <div
                v-for="(ch, index) in filteredChapters"
                :key="ch.id"
                :ref="(el) => setChapterButtonRef(ch.id, el)"
                class="group flex w-full items-center rounded-lg px-2.5 py-2 text-xs transition-colors"
                :class="
                  ch.id === chapterId ?
                    'border border-sky-200/80 bg-white text-sky-700 shadow-sm shadow-sky-100/80 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-200 dark:shadow-none'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-sky-950/35 dark:hover:text-slate-100'
                "
              >
                <button
                  class="flex-1 min-w-0 text-left"
                  @click="goToChapter(ch.id)"
                >
                  <div class="flex items-center gap-1.5">
                    <span
                      class="text-[10px] font-mono shrink-0 w-8 text-right"
                      :class="
                        ch.id === chapterId ?
                          'text-sky-500'
                        : 'text-slate-400 dark:text-slate-500'
                      "
                      >Ch.{{ index + 1 }}</span
                    >
                    <span class="truncate flex-1 font-medium">{{
                      stripChapterNumberPrefix(ch.title) || '未命名'
                    }}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5 pl-[2.2rem]">
                    <span class="text-[10px] text-(--ui-text-dimmed)"
                      >{{ ch.wordCount || 0 }} 字</span
                    >
                    <span
                      v-if="ch.status === 'completed'"
                      class="text-[10px] text-emerald-500"
                      >已完成</span
                    >
                  </div>
                </button>
                <button
                  v-if="ch.id !== chapterId"
                  class="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-(--ui-text-dimmed) hover:text-primary-500 transition-all"
                  title="在新标签页打开"
                  @click.stop="openChapterInNewTab(ch.id)"
                >
                  <Icon
                    icon="lucide:external-link"
                    class="w-3 h-3"
                  />
                </button>
                <button
                  class="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-(--ui-text-dimmed) hover:text-red-500 transition-all"
                  title="删除章节"
                  @click.stop="confirmDeleteChapter(ch)"
                >
                  <Icon
                    icon="lucide:trash-2"
                    class="w-3 h-3"
                  />
                </button>
              </div>
              <div
                v-if="!allChapters?.length"
                class="text-center py-6 text-xs text-(--ui-text-dimmed)"
              >
                暂无章节
              </div>
              <div
                v-else-if="!filteredChapters.length"
                class="text-center py-6 text-xs text-(--ui-text-dimmed)"
              >
                没有匹配章节
              </div>
            </div>
          </div>

          <!-- Characters Tab -->
          <div
            v-show="leftSidebarTab === 'characters'"
            class="flex-1 overflow-y-auto px-2 pb-2 space-y-3"
          >
            <div
              class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-2"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] font-medium text-(--ui-text-muted)">
                  本章角色 {{ selectedCharacters.length }} 位
                </span>
                <button
                  class="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-(--ui-text-muted) hover:bg-(--ui-bg-elevated)/70 hover:text-(--ui-text) transition-colors"
                  :disabled="savingChapterCharacters"
                  @click="saveChapterCharacters"
                >
                  <Icon
                    icon="lucide:save"
                    class="w-3 h-3"
                  />
                  保存
                </button>
              </div>

              <div
                v-if="selectedCharacters.length"
                class="mt-2 space-y-1"
              >
                <button
                  v-for="char in selectedChapterCharacters"
                  :key="char.id"
                  type="button"
                  class="w-full rounded px-1.5 py-1 text-left text-xs hover:bg-(--ui-bg-elevated)/70 transition-colors"
                  @click="insertCharacterName(char.name)"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--ui-primary-500) text-[10px] font-bold text-white"
                    >
                      {{ char.name.charAt(0) }}
                    </span>
                    <span
                      class="min-w-0 flex-1 truncate font-medium text-(--ui-text-highlighted)"
                      >{{ char.name }}</span
                    >
                    <Icon
                      icon="lucide:plus"
                      class="w-3 h-3 text-(--ui-text-dimmed)"
                    />
                  </div>
                  <p
                    v-if="
                      char.appearances[0]?.background ||
                      char.appearances[0]?.snippet
                    "
                    class="mt-1 line-clamp-2 pl-7 text-[10px] leading-snug text-(--ui-text-dimmed)"
                  >
                    {{
                      char.appearances[0]?.background ||
                      char.appearances[0]?.snippet
                    }}
                  </p>
                </button>
              </div>
              <p
                v-else
                class="mt-2 text-[10px] text-(--ui-text-dimmed)"
              >
                在下方勾选角色后点击「应用」添加到本章
              </p>
            </div>

            <div
              class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-2"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-[10px] font-medium text-(--ui-text-muted)">
                    本章人物变化
                  </p>
                  <p
                    v-if="pendingCharacterStateChangeCount"
                    class="mt-0.5 text-[10px] text-amber-500"
                  >
                    {{ pendingCharacterStateChangeCount }} 条待确认
                  </p>
                </div>
                <button
                  class="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-(--ui-text-muted) hover:bg-(--ui-bg-elevated)/70 hover:text-(--ui-text) transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  :disabled="extractingCharacterStateChanges"
                  @click="extractCharacterStateChanges"
                >
                  <Icon
                    :icon="
                      extractingCharacterStateChanges ? 'lucide:loader-2' : (
                        'lucide:activity'
                      )
                    "
                    class="w-3 h-3"
                    :class="{
                      'animate-spin': extractingCharacterStateChanges
                    }"
                  />
                  {{ extractingCharacterStateChanges ? '分析中...' : '分析' }}
                </button>
              </div>

              <div
                v-if="visibleCharacterStateChanges.length"
                class="mt-2 space-y-1.5"
              >
                <div
                  v-for="change in visibleCharacterStateChanges.slice(0, 5)"
                  :key="change.id"
                  class="rounded-lg bg-(--ui-bg-elevated)/70 px-2 py-1.5"
                >
                  <div class="flex items-center gap-1.5">
                    <NTag
                      size="tiny"
                      :type="
                        change.status === 'pending' ? 'warning' : 'success'
                      "
                    >
                      {{ change.status === 'pending' ? '待确认' : '已确认' }}
                    </NTag>
                    <span
                      class="truncate text-[10px] text-(--ui-text-highlighted)"
                    >
                      {{ change.characterName }} ·
                      {{ getCharacterStateChangeLabel(change.changeType) }}
                    </span>
                  </div>
                  <p
                    class="mt-1 line-clamp-2 text-[10px] leading-snug text-(--ui-text-muted)"
                  >
                    {{ change.afterValue }}
                  </p>
                </div>
              </div>
              <p
                v-else
                class="mt-2 text-[10px] text-(--ui-text-dimmed)"
              >
                保存正文后点击「分析」，抽取本章中角色状态、关系和身份变化。
              </p>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] text-(--ui-text-dimmed) truncate">
                  小说角色 {{ allCharacters?.length || 0 }} 位
                  <template v-if="detectedCharacters.length">
                    · 正文 {{ detectedCharacters.length }}
                  </template>
                </span>
                <div class="flex items-center gap-0.5 shrink-0">
                  <button
                    class="inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated)/60 hover:text-(--ui-text) transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="aiExtractingCharacters"
                    @click="extractCharactersWithAi"
                  >
                    <Icon
                      :icon="
                        aiExtractingCharacters ? 'lucide:loader-2' : (
                          'lucide:sparkles'
                        )
                      "
                      class="w-3 h-3"
                      :class="{ 'animate-spin': aiExtractingCharacters }"
                    />
                    {{ aiExtractingCharacters ? '识别中...' : 'AI识别' }}
                  </button>
                  <button
                    class="flex h-5 w-5 items-center justify-center rounded text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/60 transition-colors"
                    @click="detectCharactersFromContent"
                  >
                    <Icon
                      icon="lucide:refresh-cw"
                      class="w-3 h-3"
                      :class="{ 'animate-spin': extractingChars }"
                    />
                  </button>
                  <button
                    class="inline-flex h-5 items-center rounded px-1.5 text-[10px] text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated)/60 hover:text-(--ui-text) transition-colors"
                    :disabled="!detectedCharacters.length"
                    @click="applyDetectedCharacters"
                  >
                    应用
                  </button>
                </div>
              </div>

              <div
                v-for="char in allCharacters"
                :key="char.id"
                role="button"
                tabindex="0"
                class="w-full cursor-pointer text-left rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-(--ui-bg-muted) group border border-transparent hover:border-(--ui-border)"
                @click="toggleChapterCharacter(char.id)"
                @keydown.enter.prevent="toggleChapterCharacter(char.id)"
                @keydown.space.prevent="toggleChapterCharacter(char.id)"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    :icon="
                      selectedCharacterIds.has(char.id) ?
                        'lucide:check-square'
                      : 'lucide:square'
                    "
                    class="w-3.5 h-3.5 shrink-0"
                    :class="
                      selectedCharacterIds.has(char.id) ?
                        'text-(--ui-primary-500)'
                      : 'text-(--ui-text-dimmed)'
                    "
                  />
                  <div class="min-w-0 flex-1">
                    <span
                      class="font-semibold text-(--ui-text-highlighted) truncate"
                      >{{ char.name }}</span
                    >
                    <span
                      v-if="detectedCharacters.some((d) => d.id === char.id)"
                      class="ml-1 text-[9px] text-emerald-500"
                      >正文中</span
                    >
                  </div>
                  <button
                    type="button"
                    class="flex h-5 w-5 items-center justify-center rounded text-(--ui-text-dimmed) opacity-0 hover:bg-(--ui-bg-elevated) hover:text-(--ui-text) group-hover:opacity-100 transition-all"
                    @click.stop="insertCharacterName(char.name)"
                  >
                    <Icon
                      icon="lucide:plus"
                      class="w-3 h-3"
                    />
                  </button>
                </div>
              </div>

              <div
                v-if="!allCharacters?.length"
                class="text-center py-5 text-xs text-(--ui-text-dimmed)"
              >
                <div class="flex flex-col items-center gap-1">
                  <Icon
                    icon="lucide:users"
                    class="w-5 h-5 opacity-40"
                  />
                  <p>还没有角色</p>
                  <p class="text-[10px] opacity-60">
                    点击「AI识别」从正文中提取角色
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Versions Tab -->
          <div
            v-show="leftSidebarTab === 'versions'"
            class="flex-1 overflow-y-auto px-2 pb-2 space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] text-(--ui-text-dimmed)">
                共 {{ versions.length }} 个版本
              </span>
              <button
                class="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated)/70 hover:text-(--ui-text) transition-colors"
                @click="refreshVersions()"
              >
                <Icon
                  icon="lucide:refresh-cw"
                  class="w-3 h-3"
                />
                刷新
              </button>
            </div>

            <div
              v-for="v in versions.slice().reverse()"
              :key="v.id"
              class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-2 text-xs transition-colors hover:ring-(--ui-border)"
            >
              <div class="flex items-center justify-between gap-1 mb-1">
                <span class="font-medium text-(--ui-text-highlighted)">
                  V{{ v.versionNumber }}
                </span>
                <span
                  class="text-[10px] px-1 rounded"
                  :class="
                    v.source === 'ai_generated' ?
                      'bg-violet-500/10 text-violet-500'
                    : 'bg-(--ui-primary-500)/10 text-(--ui-primary-500)'
                  "
                >
                  {{ v.source === 'ai_generated' ? 'AI生成' : '用户编辑' }}
                </span>
              </div>
              <p class="text-[10px] text-(--ui-text-dimmed) mb-1.5">
                {{ new Date(v.createdAt).toLocaleString() }}
              </p>
              <div class="flex flex-wrap items-center gap-1">
                <NButton
                  size="tiny"
                  quaternary
                  @click="viewVersionDiff(v)"
                >
                  <template #icon><Icon icon="lucide:git-compare" /></template>
                  对比
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  :loading="rollingBack"
                  @click="rollbackVersion(v)"
                >
                  <template #icon><Icon icon="lucide:undo-2" /></template>
                  回滚
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  type="warning"
                  :loading="undoingVersionId === v.id"
                  @click="undoVersion(v)"
                >
                  <template #icon><Icon icon="lucide:rotate-ccw" /></template>
                  撤销
                </NButton>
              </div>
            </div>

            <div
              v-if="!versions.length"
              class="text-center py-6 text-xs text-(--ui-text-dimmed)"
            >
              <div class="flex flex-col items-center gap-1">
                <Icon
                  icon="lucide:history"
                  class="w-5 h-5 opacity-40"
                />
                <p>暂无历史版本</p>
                <p class="text-[10px] opacity-60">每次保存后会自动生成版本</p>
              </div>
            </div>
          </div>

          <!-- Notes Tab -->
          <div
            v-show="leftSidebarTab === 'notes'"
            class="flex-1 overflow-y-auto px-2 pb-2 flex flex-col"
          >
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-[10px] text-(--ui-text-dimmed)">
                作者笔记（仅自己可见）
              </span>
              <span
                v-if="savingNote"
                class="text-[10px] text-(--ui-text-dimmed)"
              >
                <NSpin
                  :size="12"
                  class="inline-block mr-1"
                />
                保存中...
              </span>
              <span
                v-else-if="chapterNote?.updatedAt"
                class="text-[10px] text-(--ui-text-dimmed)"
              >
                已保存
              </span>
            </div>
            <NInput
              v-model:value="noteContent"
              type="textarea"
              :autosize="{ minRows: 6, maxRows: 20 }"
              placeholder="写下这一章的写作思路、伏笔安排、待修改点..."
              class="flex-1"
              @input="onNoteInput"
            />
            <p class="mt-2 text-[10px] text-(--ui-text-dimmed)">
              支持 Markdown 语法，换行即可保存。
            </p>
          </div>

          <!-- Checks Tab -->
          <div
            v-show="leftSidebarTab === 'checks'"
            class="flex-1 overflow-y-auto px-2 pb-2"
          >
            <EditorConsistencyWarnings
              ref="consistencyWarningsRef"
              :novel-id="novelId"
              :chapter-id="chapterId"
            />
          </div>
        </template>
      </div>

      <!-- Editor -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
        <div class="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-3 sm:px-5">
          <div
            class="editor-canvas flex-1 min-h-0 w-full overflow-y-auto"
            style="height: 0"
            @scroll="showFloatingToolbar = false"
          >
            <div
              ref="editorContainerRef"
              class="chapter-writing-surface min-h-full w-full px-4 py-4 text-[15px] leading-[1.9] text-slate-800 sm:px-6 sm:py-5 dark:text-slate-100"
              :class="zenMode ? 'min-h-screen leading-[2.05] lg:px-[6vw]' : ''"
              @mousedown="onEditorMousedown"
              :style="
                zenMode ?
                  { fontSize: `${zenFontSize}px`, fontFamily: zenFontFamily }
                : {}
              "
              @mouseup="handleTextSelect"
            />
          </div>

          <!-- AI Action Result -->
          <div
            v-if="aiActionResult || (expandingOrRewriting && aiActionType)"
            class="ai-result-panel mt-3 w-full rounded-xl bg-(--ui-bg-elevated) border border-(--ui-border)/50 border-l-2 border-l-primary-400 shadow-sm max-h-[50vh] overflow-y-auto"
            @mousedown.prevent
          >
            <div
              class="sticky top-0 z-10 flex items-center justify-between p-4 pb-2 bg-(--ui-bg-elevated) rounded-t-xl"
            >
              <div class="flex items-center gap-2">
                <span
                  class="size-1.5 rounded-full bg-primary-400"
                  :class="expandingOrRewriting ? 'animate-pulse' : ''"
                />
                <p
                  class="text-xs font-medium text-primary-600 dark:text-primary-400"
                >
                  {{
                    aiActionType === 'expand' ? t('chapter.expand')
                    : aiActionType === 'continue' ? t('chapter.continue')
                    : t('chapter.rewrite')
                  }}
                </p>
                <span
                  v-if="expandingOrRewriting && !aiActionResult"
                  class="text-xs text-(--ui-text-dimmed)"
                  >生成中...</span
                >
              </div>
              <div class="flex gap-1">
                <NButton
                  size="tiny"
                  type="primary"
                  :disabled="!aiActionResult || expandingOrRewriting"
                  @click="applyAiResult"
                  >应用</NButton
                >
                <NButton
                  size="tiny"
                  quaternary
                  @click="discardAiResult"
                  >放弃</NButton
                >
              </div>
            </div>
            <div class="px-4 pb-4">
              <!-- Track Changes Diff View for rewrite -->
              <div
                v-if="aiActionType === 'rewrite' && trackChangesDiff.length"
                class="space-y-0.5"
              >
                <div
                  v-for="(line, idx) in trackChangesDiff"
                  :key="idx"
                  class="flex items-start gap-2 text-sm leading-relaxed rounded px-1.5 py-0.5"
                  :class="{
                    'bg-red-500/8': line.type === 'remove',
                    'bg-emerald-500/8': line.type === 'add'
                  }"
                >
                  <span
                    class="shrink-0 text-[10px] font-mono mt-0.5 w-4 text-right"
                    :class="{
                      'text-red-500': line.type === 'remove',
                      'text-emerald-500': line.type === 'add',
                      'text-(--ui-text-dimmed)': line.type === 'same'
                    }"
                  >
                    {{
                      line.type === 'remove' ? '-'
                      : line.type === 'add' ? '+'
                      : ' '
                    }}
                  </span>
                  <span
                    :class="{
                      'text-red-600 dark:text-red-400 line-through opacity-70':
                        line.type === 'remove',
                      'text-emerald-600 dark:text-emerald-400':
                        line.type === 'add',
                      'text-(--ui-text-muted)': line.type === 'same'
                    }"
                  >
                    {{ line.value || ' ' }}
                  </span>
                </div>
              </div>
              <div
                v-else
                class="text-(--ui-text) whitespace-pre-wrap text-sm leading-relaxed"
              >
                {{ aiActionResult }}
              </div>
            </div>
          </div>

          <!-- Generated Content Preview -->
          <div
            v-if="(generating || regenerating) && generatedContent"
            class="mt-3 w-full p-4 rounded-xl bg-(--ui-bg-elevated) border border-(--ui-border)/50 shadow-sm"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="size-1.5 rounded-full bg-violet-400 animate-pulse" />
              <p class="text-xs font-medium text-violet-500">
                {{
                  regenerating ? '基于反馈重新生成中...' : t('ai.generating')
                }}
              </p>
              <button
                class="ml-auto text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                @click="stopGeneration"
              >
                停止生成
              </button>
            </div>
            <div
              ref="generatedContentScrollRef"
              class="max-h-[40vh] overflow-y-auto text-(--ui-text) whitespace-pre-wrap text-sm leading-relaxed"
            >
              {{ generatedContent }}
            </div>
          </div>

          <!-- Feedback Regeneration -->
          <div
            v-if="!generating && !regenerating && previousGeneratedContent"
            class="mt-3 w-full p-3 rounded-xl bg-(--ui-bg-elevated) border border-(--ui-border)/50 border-l-2 border-l-amber-400 shadow-sm"
          >
            <div
              v-if="!showFeedbackInput"
              class="flex items-center justify-between"
            >
              <p class="text-xs text-(--ui-text-dimmed)">对生成结果不满意？</p>
              <NButton
                size="tiny"
                quaternary
                @click="showFeedbackInput = true"
              >
                <template #icon
                  ><Icon icon="lucide:message-square-plus"
                /></template>
                基于反馈重新生成
              </NButton>
            </div>
            <div
              v-else
              class="space-y-2"
            >
              <NInput
                v-model:value="feedbackText"
                type="textarea"
                :rows="2"
                placeholder="输入反馈，如：更戏剧化、节奏太快、多加对话..."
                size="small"
              />
              <div class="flex justify-end gap-1.5">
                <NButton
                  size="tiny"
                  quaternary
                  @click="cancelFeedbackRegeneration"
                  >取消</NButton
                >
                <NButton
                  size="tiny"
                  type="primary"
                  :disabled="!feedbackText.trim()"
                  :loading="regenerating"
                  @click="regenerateWithFeedback"
                >
                  重新生成
                </NButton>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Suggestion Mode Panel -->
        <div
          v-if="suggestionModeActive && suggestions.length"
          class="shrink-0 max-h-[40vh] overflow-y-auto border-t border-primary-300/30 bg-primary-50/5"
        >
          <div
            class="flex items-center justify-between px-3 py-2 border-b border-(--ui-border) sticky top-0 bg-(--ui-bg-elevated) z-10"
          >
            <div class="flex items-center gap-2">
              <Icon
                icon="lucide:message-square-diff"
                class="w-3.5 h-3.5 text-primary-500"
              />
              <span
                class="text-xs font-medium text-primary-600 dark:text-primary-400"
              >
                AI 建议模式 · {{ suggestionsPendingCount }} 条待处理
              </span>
            </div>
            <div class="flex gap-1">
              <NButton
                size="tiny"
                type="primary"
                @click="applyAllAcceptedSuggestions"
                >全部接受</NButton
              >
              <NButton
                size="tiny"
                quaternary
                @click="clearAllSuggestions"
                >全部拒绝</NButton
              >
            </div>
          </div>
          <div class="divide-y divide-(--ui-border)">
            <div
              v-for="(suggestion, idx) in suggestions"
              :key="idx"
              class="px-3 py-2.5 transition-colors"
              :class="{
                'opacity-40': suggestion.status !== 'pending',
                'bg-emerald-500/5': suggestion.status === 'accepted',
                'bg-red-500/5': suggestion.status === 'rejected'
              }"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0 space-y-1">
                  <p class="text-xs text-(--ui-text-dimmed)">
                    {{ suggestion.reason }}
                  </p>
                  <div class="text-sm leading-relaxed">
                    <span class="text-red-500 line-through"
                      >{{ suggestion.originalText.slice(0, 80)
                      }}{{
                        suggestion.originalText.length > 80 ? '...' : ''
                      }}</span
                    >
                    <span class="mx-1 text-(--ui-text-dimmed)">→</span>
                    <span class="text-emerald-600 dark:text-emerald-400"
                      >{{ suggestion.suggestedText.slice(0, 80)
                      }}{{
                        suggestion.suggestedText.length > 80 ? '...' : ''
                      }}</span
                    >
                  </div>
                </div>
                <div
                  v-if="suggestion.status === 'pending'"
                  class="flex gap-1 shrink-0"
                >
                  <NButton
                    size="tiny"
                    type="primary"
                    @click="applySuggestion(idx)"
                  >
                    <template #icon><Icon icon="lucide:check" /></template>
                  </NButton>
                  <NButton
                    size="tiny"
                    quaternary
                    @click="rejectSuggestionAt(idx)"
                  >
                    <template #icon><Icon icon="lucide:x" /></template>
                  </NButton>
                </div>
                <span
                  v-else
                  class="text-[10px] shrink-0"
                  :class="
                    suggestion.status === 'accepted' ?
                      'text-emerald-500'
                    : 'text-red-400'
                  "
                >
                  {{ suggestion.status === 'accepted' ? '已接受' : '已拒绝' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Editor Status Bar -->
        <div
          v-if="!zenMode"
          class="flex shrink-0 flex-col border-t border-sky-100/70 bg-white/70 backdrop-blur dark:border-sky-900/45 dark:bg-slate-950/55"
        >
          <!-- Progress indicator -->
          <div
            class="relative mx-4 h-[2px] overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950"
          >
            <div
              class="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              :class="
                chapterProgress >= 100 ? 'bg-emerald-400' : 'bg-sky-500/70'
              "
              :style="{ width: `${chapterProgress}%` }"
            />
          </div>
          <!-- Status bar content -->
          <div
            class="flex items-center justify-between px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400"
          >
            <!-- Left: Writing status -->
            <div class="flex items-center gap-2.5">
              <span
                class="flex items-center gap-1"
                :class="saveStatusClass"
              >
                <Icon
                  :icon="
                    conflictDetected ? 'lucide:triangle-alert'
                    : saving ? 'lucide:loader-circle'
                    : 'lucide:check-circle'
                  "
                  class="size-3"
                  :class="saving ? 'animate-spin' : ''"
                />
                {{ saveStatusText }}
              </span>
              <span class="h-3 w-px bg-sky-100 dark:bg-sky-900/60" />
              <span class="tabular-nums"
                >{{ currentWordCount.toLocaleString() }} 字</span
              >
              <span class="hidden sm:inline tabular-nums"
                >{{ currentLineCount }} 行</span
              >
            </div>
            <!-- Center: Chapter progress label -->
            <div class="hidden md:flex items-center gap-1.5 text-[10px]">
              <span
                v-if="chapterProgress >= 100"
                class="text-emerald-500"
                >目标已达成</span
              >
              <span
                v-else
                class="text-slate-400 dark:text-slate-500"
                >{{ currentWordCount }} / {{ chapterGoal }} 字</span
              >
            </div>
            <!-- Right: Token estimate -->
            <div class="flex items-center gap-2.5">
              <span
                class="tabular-nums"
                :title="t('chapter.generateDialog.maxTokensHint')"
              >
                ~{{ estimatedContextTokens }} tokens
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Teleport to="body">
      <Transition name="fade-scale">
        <div
          v-if="showFloatingToolbar && !generating"
          class="fixed z-50 flex items-center gap-0.5 px-2 py-1.5 rounded-xl card-glass shadow-xl"
          :style="{
            left: `${floatingToolbarPos.x}px`,
            top: `${floatingToolbarPos.y}px`,
            transform: 'translate(-50%, -100%)'
          }"
        >
          <NTooltip
            v-if="selectedText"
            trigger="hover"
          >
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                :loading="expandingOrRewriting"
                @click="doAiAction('expand')"
              >
                <template #icon>
                  <Icon icon="lucide:expand" />
                </template>
                {{ t('chapter.expand') }}
              </NButton>
            </template>
            补充细节，让选中内容更丰富生动
          </NTooltip>
          <NTooltip
            v-if="selectedText"
            trigger="hover"
          >
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                :loading="expandingOrRewriting"
                @click="doAiAction('rewrite')"
              >
                <template #icon>
                  <Icon icon="lucide:refresh-cw" />
                </template>
                {{ t('chapter.rewrite') }}
              </NButton>
            </template>
            换一种写法，提升选中内容的质量
          </NTooltip>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                :loading="expandingOrRewriting"
                :disabled="!aiActionAvailable"
                @click="doAiAction('continue')"
              >
                <template #icon>
                  <Icon icon="lucide:pen-line" />
                </template>
                {{ t('chapter.continue') }}
              </NButton>
            </template>
            从光标处接着往下写新内容
          </NTooltip>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                :loading="expandingOrRewriting"
                :disabled="!aiActionAvailable"
                @click="doAiAction('continue', '自然收尾')"
              >
                <template #icon>
                  <Icon icon="lucide:circle-check" />
                </template>
                自然结尾
              </NButton>
            </template>
            写一个收束段落，让情节自然停顿
          </NTooltip>
          <NDropdown
            trigger="hover"
            :options="[
              {
                label: '对话 - 生成人物对话',
                key: 'dialogue',
                icon: () => h(Icon, { icon: 'lucide:message-circle' })
              },
              {
                label: '环境描写 - 场景与氛围',
                key: 'description',
                icon: () => h(Icon, { icon: 'lucide:mountain' })
              },
              {
                label: '动作场景 - 节奏紧凑的画面',
                key: 'action',
                icon: () => h(Icon, { icon: 'lucide:swords' })
              },
              {
                label: '内心独白 - 角色心理活动',
                key: 'monologue',
                icon: () => h(Icon, { icon: 'lucide:brain' })
              }
            ]"
            @select="(key) => doFragment(key as any)"
          >
            <NButton
              size="tiny"
              quaternary
              :loading="expandingOrRewriting"
              :disabled="!aiActionAvailable"
            >
              <template #icon>
                <Icon icon="lucide:scissors" />
              </template>
              片段
            </NButton>
          </NDropdown>
        </div>
      </Transition>
    </Teleport>

    <KeyboardShortcutsHelp
      v-model:show="showShortcutHelp"
      storage-key="chapter_editor_shortcuts"
      :shortcuts="[
        { label: '保存当前章节', keys: 'Ctrl + S', action: 'save' },
        { label: '打开 AI 生成章节', keys: 'Ctrl + G', action: 'generate' },
        { label: '搜索章节列表', keys: 'Ctrl + K', action: 'search' },
        { label: '切换禅模式', keys: 'Ctrl + Shift + Z', action: 'zen' },
        { label: '扩写选中文本', keys: 'Ctrl + E', action: 'expand' },
        { label: '在光标处续写', keys: 'Ctrl + J', action: 'continue' },
        { label: '打开/关闭快捷键帮助', keys: 'Ctrl + /', action: 'help' }
      ]"
    />

    <!-- Generate Dialog -->
    <NModal
      v-model:show="showGenerateDialog"
      preset="card"
      :title="t('chapter.generateDialog.title')"
      style="width: min(92vw, 720px); max-width: 92vw"
    >
      <div class="space-y-4">
        <div class="w-full overflow-x-auto pb-1">
          <NSteps
            :current="generateWizardStep"
            size="small"
            class="min-w-[560px]"
          >
            <NStep title="本章大纲" />
            <NStep title="推荐角色" />
            <NStep title="大致剧情" />
            <NStep title="上下文确认" />
            <NStep title="生成正文" />
          </NSteps>
        </div>
        <NAlert
          type="info"
          :show-icon="false"
        >
          先确认本章大纲，再按大纲推荐角色，最后补充剧情要求后生成正文。
        </NAlert>
        <div
          v-show="generateWizardStep === 1"
          class="space-y-4"
        >
          <NFormItem label="本章大纲">
            <NInput
              v-model:value="chapterOutlineDraft"
              type="textarea"
              placeholder="确认或修改本章大纲"
              :rows="4"
            />
          </NFormItem>
          <NFormItem label="大纲生成提示词">
            <NInput
              v-model:value="outlineIdea"
              type="textarea"
              placeholder="可选：给 AI 一个本章规划方向"
              :rows="2"
            />
          </NFormItem>
          <div class="flex flex-wrap justify-end gap-2">
            <NButton
              type="primary"
              :loading="generatingChapterOutline"
              :disabled="!aiActionAvailable"
              @click="generateSingleChapterOutline"
            >
              生成/重拟大纲
            </NButton>
            <NButton
              secondary
              type="primary"
              :loading="savingChapterOutline"
              :disabled="!chapterOutlineDraft.trim()"
              @click="saveCurrentChapterOutline"
            >
              保存大纲
            </NButton>
          </div>
        </div>

        <div
          v-show="generateWizardStep === 2"
          class="space-y-4"
        >
          <NFormItem label="本章角色">
            <div class="w-full space-y-2">
              <div
                class="flex items-center justify-between gap-3 text-xs text-gray-400"
              >
                <span
                  >按大纲推荐
                  {{ recommendedCharactersByOutline.length }} 个，已选
                  {{ selectedCharacterIds.size }} 个</span
                >
                <NButton
                  size="tiny"
                  quaternary
                  :disabled="!recommendedCharactersByOutline.length"
                  @click="applyRecommendedCharacters"
                >
                  应用推荐
                </NButton>
              </div>
              <div
                class="max-h-56 overflow-auto rounded-lg border border-gray-100 p-2 dark:border-gray-800"
              >
                <NCheckbox
                  v-for="character in allCharacters || []"
                  :key="character.id"
                  :checked="selectedCharacterIds.has(character.id)"
                  class="w-full py-1"
                  @update:checked="toggleChapterCharacter(character.id)"
                >
                  <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm text-gray-800 dark:text-gray-100">{{
                        character.name
                      }}</span>
                      <NTag
                        v-if="
                          recommendedCharactersByOutline.some(
                            (item) => item.id === character.id
                          )
                        "
                        size="small"
                        type="success"
                        :bordered="false"
                      >
                        大纲推荐
                      </NTag>
                      <NTag
                        v-if="
                          !character.description &&
                          isTitleLikeCharacterName(character.name)
                        "
                        size="small"
                        type="warning"
                        :bordered="false"
                      >
                        疑似称谓
                      </NTag>
                      <NButton
                        v-if="hasMissingCharacterProfile(character)"
                        size="tiny"
                        secondary
                        :loading="isEnrichingCharacter(character.id)"
                        @click.stop.prevent="enrichChapterCharacter(character)"
                      >
                        <template #icon>
                          <Icon
                            icon="lucide:sparkles"
                            class="size-3"
                          />
                        </template>
                        AI 补全资料
                      </NButton>
                    </div>
                    <div class="text-xs leading-relaxed text-gray-500">
                      {{ getCharacterNote(character) }}
                    </div>
                  </div>
                </NCheckbox>
              </div>
              <div class="flex justify-end">
                <NButton
                  size="tiny"
                  quaternary
                  :loading="savingChapterCharacters"
                  @click="saveChapterCharacters"
                >
                  保存角色绑定
                </NButton>
              </div>
            </div>
          </NFormItem>
        </div>

        <div
          v-show="generateWizardStep === 3"
          class="space-y-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs text-gray-400">
              根据已确认大纲和角色生成可验收的剧情计划
            </span>
            <div class="flex flex-wrap gap-2">
              <NButton
                type="primary"
                secondary
                :loading="generatingChapterPlan"
                :disabled="!aiActionAvailable || !chapterOutlineDraft.trim()"
                @click="generateChapterPlan"
              >
                AI 生成计划
              </NButton>
              <NButton
                type="success"
                :loading="acceptingChapterPlan"
                :disabled="!currentWorkflowPlanId || chapterPlanBlocked"
                @click="acceptCurrentChapterPlan"
              >
                验收计划
              </NButton>
            </div>
          </div>
          <NAlert
            v-if="acceptedWorkflowPlanId"
            type="success"
            :show-icon="false"
          >
            剧情计划已验收，正文生成将使用该计划快照。
          </NAlert>
          <NAlert
            v-else-if="chapterPlanIssues.length"
            :type="chapterPlanBlocked ? 'error' : 'warning'"
            :show-icon="false"
          >
            <div class="space-y-1 text-xs">
              <div
                v-for="issue in chapterPlanIssues"
                :key="`${issue.code}-${issue.message}`"
              >
                {{ issue.severity === 'error' ? '阻断' : '提醒' }}：{{
                  issue.message
                }}
              </div>
            </div>
          </NAlert>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <NFormItem label="本章目标">
              <NInput
                v-model:value="chapterPlanForm.goal"
                type="textarea"
                placeholder="这一章要推进什么"
                :rows="2"
              />
            </NFormItem>
            <NFormItem label="核心冲突">
              <NInput
                v-model:value="chapterPlanForm.conflict"
                type="textarea"
                placeholder="本章的两难、对抗或压力来源"
                :rows="2"
              />
            </NFormItem>
            <NFormItem label="关键转折">
              <NInput
                v-model:value="chapterPlanForm.turningPoint"
                type="textarea"
                placeholder="本章中读者预期被改变的节点"
                :rows="2"
              />
            </NFormItem>
            <NFormItem label="剧情节拍">
              <NInput
                v-model:value="chapterPlanForm.beats"
                type="textarea"
                placeholder="一行一个节拍，按正文推进顺序填写"
                :rows="3"
              />
            </NFormItem>
            <NFormItem label="必须出现">
              <NInput
                v-model:value="chapterPlanForm.mustInclude"
                type="textarea"
                placeholder="必须写到的人物、事件、物件"
                :rows="2"
              />
            </NFormItem>
            <NFormItem label="避免出现">
              <NInput
                v-model:value="chapterPlanForm.avoid"
                type="textarea"
                placeholder="不要提前揭露、不要让谁出场"
                :rows="2"
              />
            </NFormItem>
            <NFormItem label="兴趣钩子">
              <NInput
                v-model:value="chapterPlanForm.interestHooks"
                type="textarea"
                placeholder="反转、悬念、爽点或章末牵引"
                :rows="2"
              />
            </NFormItem>
            <NFormItem label="情绪/节奏">
              <NInput
                v-model:value="chapterPlanForm.pacing"
                type="textarea"
                placeholder="紧张、克制、暧昧、压迫感等"
                :rows="2"
              />
            </NFormItem>
          </div>
          <NFormItem label="称谓或设定补充">
            <NInput
              v-model:value="chapterPlanForm.protocol"
              type="textarea"
              placeholder="例如：太监称女主为小主，丫鬟不可直呼其他嫔妃姓名"
              :rows="2"
            />
          </NFormItem>
        </div>

        <div
          v-show="generateWizardStep === 4"
          class="space-y-4"
        >
          <GenerationContextPreview
            ref="generationContextPreviewRef"
            :novel-id="novelId"
            :chapter-id="chapterId"
            :chapter-outline="chapterOutlineDraft"
            :direction="buildFinalGenerateDirection()"
            :ai-config-id="selectedAiConfigId"
            :skill-ids="selectedSkillIds"
            @update:selection="generationContextSelection = $event"
            @ready-change="generationContextReady = $event"
          />
        </div>

        <div
          v-show="generateWizardStep === 5"
          class="space-y-4"
        >
          <NFormItem label="Prompt 模板">
            <div class="w-full space-y-2">
              <div class="flex gap-2">
                <NSelect
                  v-model:value="selectedTemplateId"
                  :options="
                    promptTemplates.map((t) => ({
                      label: t.name + (t.isSystem ? ' (系统)' : ''),
                      value: t.id
                    }))
                  "
                  placeholder="选择已保存的模板"
                  clearable
                  class="flex-1"
                  @update:value="applyTemplate"
                />
                <NButton
                  size="small"
                  quaternary
                  @click="
                    selectedTemplateId ?
                      deleteTemplate(selectedTemplateId)
                    : null
                  "
                  :disabled="
                    !selectedTemplateId ||
                    promptTemplates.find((t) => t.id === selectedTemplateId)
                      ?.isSystem
                  "
                >
                  <template #icon><Icon icon="lucide:trash-2" /></template>
                </NButton>
              </div>
              <div class="flex justify-end">
                <NButton
                  size="tiny"
                  quaternary
                  :disabled="!selectedTemplateId"
                  @click="saveTemplateAsNovelDefault"
                >
                  设为本书默认
                </NButton>
              </div>
            </div>
          </NFormItem>
          <NFormItem label="写作技能">
            <div class="w-full space-y-2">
              <NSelect
                v-model:value="selectedSkillIds"
                :options="skillOptions"
                multiple
                clearable
                placeholder="选择写作技能包（可多选，注入写作手法与范文）"
                max-tag-count="responsive"
              />
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  生成时注入所选技能包的写作手法与范文
                </span>
                <NButton
                  size="tiny"
                  quaternary
                  :loading="savingNovelDefault"
                  @click="saveSkillsAsNovelDefault"
                >
                  设为本书默认
                </NButton>
              </div>
            </div>
          </NFormItem>
          <NFormItem :label="t('chapter.generateDialog.direction')">
            <div class="w-full space-y-2">
              <NInput
                v-model:value="generateDirection"
                type="textarea"
                :placeholder="t('chapter.generateDialog.directionPlaceholder')"
                :rows="3"
              />
              <div class="flex justify-end">
                <template v-if="!showSaveTemplateInput">
                  <NButton
                    size="tiny"
                    quaternary
                    :disabled="!generateDirection.trim()"
                    @click="showSaveTemplateInput = true"
                  >
                    <template #icon
                      ><Icon icon="lucide:bookmark-plus"
                    /></template>
                    保存为模板
                  </NButton>
                </template>
                <template v-else>
                  <div class="flex gap-1 items-center">
                    <NInput
                      v-model:value="newTemplateName"
                      size="tiny"
                      placeholder="模板名称"
                      style="width: 140px"
                      @keyup.enter="saveAsTemplate"
                    />
                    <NButton
                      size="tiny"
                      type="primary"
                      @click="saveAsTemplate"
                      >保存</NButton
                    >
                    <NButton
                      size="tiny"
                      quaternary
                      @click="showSaveTemplateInput = false"
                      >取消</NButton
                    >
                  </div>
                </template>
              </div>
            </div>
          </NFormItem>
          <NFormItem
            :label="t('chapter.generateDialog.model')"
            required
          >
            <NSelect
              v-model:value="selectedAiConfigId"
              :options="generationModelOptions"
              placeholder="选择用于生成的模型"
            />
          </NFormItem>
          <NFormItem :label="t('chapter.generateDialog.temperature')">
            <div class="w-full space-y-1">
              <NSlider
                :value="
                  generationSamplingLocked ?
                    effectiveGenerationTemperature
                  : generateTemperature
                "
                :min="0"
                :max="2"
                :step="0.1"
                :disabled="generationSamplingLocked"
                :tooltip="true"
                @update:value="generateTemperature = $event"
              />
              <div class="flex justify-between text-xs text-gray-400">
                <span>{{ generationSamplingHint }}</span>
                <span>{{
                  formatSamplingNumber(effectiveGenerationTemperature, 0.7)
                }}</span>
              </div>
            </div>
          </NFormItem>
          <NFormItem label="top_p">
            <div class="w-full space-y-1">
              <NSlider
                :value="
                  generationSamplingLocked ?
                    effectiveGenerationTopP
                  : generateTopP
                "
                :min="0.01"
                :max="1"
                :step="0.01"
                :disabled="generationSamplingLocked"
                :tooltip="true"
                @update:value="generateTopP = $event"
              />
              <div class="flex justify-between text-xs text-gray-400">
                <span>{{ generationSamplingHint }}</span>
                <span>{{
                  formatSamplingNumber(effectiveGenerationTopP, 0.95)
                }}</span>
              </div>
            </div>
          </NFormItem>
          <NAlert
            v-if="generationSamplingLocked"
            type="warning"
            :show-icon="false"
          >
            当前模型启用思考时不支持自定义 temperature /
            top_p，生成时会跟随模型配置里的默认采样值。
          </NAlert>
          <div
            v-if="selectedGenerationConfig?.aiModel.supportsThinking"
            class="grid gap-3 sm:grid-cols-2"
          >
            <NFormItem label="思考模式">
              <NCheckbox
                :checked="generateThinkingEnabled === true"
                @update:checked="
                  (checked) => {
                    generateThinkingEnabled = checked ? true : false
                  }
                "
              >
                启用思考
              </NCheckbox>
            </NFormItem>
            <NFormItem label="思考强度">
              <NSelect
                v-model:value="generateReasoningEffort"
                :options="reasoningOptions"
                clearable
                placeholder="继承模型配置"
              />
            </NFormItem>
          </div>
          <NFormItem :label="t('chapter.generateDialog.maxTokens')">
            <NInputNumber
              v-model:value="generateMaxTokens"
              :min="512"
              :max="128000"
              :step="256"
              class="w-full"
            />
            <template #feedback>
              <span class="text-xs text-gray-400">{{
                t('chapter.generateDialog.maxTokensHint')
              }}</span>
            </template>
          </NFormItem>
          <NAlert
            v-if="!generationModelOptions.length"
            type="warning"
            title="还没有可用的内容生成模型"
          >
            请先到设置页创建并启用一个内容生成模型。
          </NAlert>
          <NAlert
            type="info"
            :show-icon="false"
          >
            <div class="grid grid-cols-1 gap-1 text-xs text-gray-500">
              <div
                v-for="item in generationContextSummary"
                :key="item.label"
                class="flex gap-2"
              >
                <span class="shrink-0 text-gray-400">{{ item.label }}：</span>
                <span class="min-w-0 truncate">{{ item.value }}</span>
              </div>
            </div>
          </NAlert>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-between gap-2">
          <NButton @click="showGenerateDialog = false">{{
            t('common.cancel')
          }}</NButton>
          <div class="flex gap-2">
            <NButton
              :disabled="generateWizardStep <= 1"
              @click="prevGenerateWizardStep"
            >
              上一步
            </NButton>
            <NButton
              v-if="generateWizardStep < 5"
              type="primary"
              :disabled="
                (generateWizardStep === 1 && !chapterOutlineDraft.trim()) ||
                (generateWizardStep === 3 && !acceptedWorkflowPlanId)
              "
              :loading="generateWizardStep === 2 && savingChapterCharacters"
              @click="nextGenerateWizardStep"
            >
              下一步
            </NButton>
            <NButton
              v-else
              type="primary"
              :disabled="
                !selectedAiConfigId ||
                !aiActionAvailable ||
                !chapterOutlineDraft.trim()
              "
              :loading="refreshingGenerationContext"
              @click="generateChapter"
            >
              <template #icon><Icon icon="lucide:sparkles" /></template>
              {{ t('chapter.generate') }}
            </NButton>
          </div>
        </div>
      </template>
    </NModal>

    <!-- Version Diff Modal -->
    <NModal
      v-model:show="showVersionDiff"
      preset="card"
      title="版本对比"
      style="max-width: 640px"
    >
      <div
        v-if="diffVersion"
        class="mb-3 flex items-center gap-2"
      >
        <span
          class="text-[10px] px-1 rounded"
          :class="
            diffVersion.source === 'ai_generated' ?
              'bg-violet-500/10 text-violet-500'
            : 'bg-(--ui-primary-500)/10 text-(--ui-primary-500)'
          "
        >
          {{ diffVersion.source === 'ai_generated' ? 'AI生成' : '用户编辑' }}
        </span>
        <span class="text-xs text-(--ui-text-dimmed)">
          V{{ diffVersion.versionNumber }} ·
          {{ new Date(diffVersion.createdAt).toLocaleString() }}
        </span>
      </div>
      <div
        class="max-h-[60vh] overflow-y-auto rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3 text-xs leading-relaxed space-y-0.5"
      >
        <div
          v-for="(line, idx) in diffLines"
          :key="idx"
          class="px-1 rounded"
          :class="
            line.type === 'add' ?
              'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : line.type === 'remove' ?
              'bg-rose-500/10 text-rose-700 dark:text-rose-400 line-through opacity-70'
            : 'text-(--ui-text)'
          "
        >
          <span
            v-if="line.type === 'add'"
            class="mr-1 select-none text-emerald-500"
            >+</span
          >
          <span
            v-else-if="line.type === 'remove'"
            class="mr-1 select-none text-rose-500"
            >-</span
          >
          <span
            v-else
            class="mr-1 select-none text-(--ui-text-dimmed)"
          >
          </span>
          {{ line.value || ' ' }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            size="small"
            @click="showVersionDiff = false"
          >
            关闭
          </NButton>
          <NButton
            v-if="diffVersion"
            size="small"
            type="warning"
            :loading="undoingVersionId === diffVersion.id"
            @click="undoVersion(diffVersion)"
          >
            <template #icon><Icon icon="lucide:rotate-ccw" /></template>
            直接撤销
          </NButton>
          <NButton
            v-if="diffVersion"
            size="small"
            type="primary"
            :loading="rollingBack"
            @click="rollbackVersion(diffVersion)"
          >
            <template #icon><Icon icon="lucide:undo-2" /></template>
            回滚到此版本
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- New Chapter Dialog -->
    <NModal
      v-model:show="showNewChapterDialog"
      preset="card"
      title="新建章节"
      style="max-width: 400px"
    >
      <div class="space-y-3">
        <NInput
          v-model:value="newChapterTitle"
          placeholder="章节标题（可留空，目录按顺序自动编号）"
          autofocus
          @keydown.enter="createNewChapter"
        />
        <div
          v-if="allChapters && allChapters.length"
          class="space-y-2"
        >
          <NSelect
            v-model:value="newChapterPosition"
            size="small"
            :options="chapterPositionOptions"
          />
          <NSelect
            v-if="newChapterPosition !== 'end'"
            v-model:value="newChapterRefId"
            size="small"
            filterable
            placeholder="选择参考章节"
            :options="chapterRefOptions"
          />
        </div>
        <div
          v-if="generatingTitle || suggestedNewChapterTitle"
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-3 text-sm"
        >
          <div
            class="mb-2 flex items-center gap-2 text-xs text-(--ui-text-dimmed)"
          >
            <Icon
              icon="lucide:sparkles"
              class="h-3.5 w-3.5"
              :class="{ 'animate-spin': generatingTitle }"
            />
            <span>{{
              generatingTitle ? '正在生成章节名...' : 'AI 候选章节名'
            }}</span>
          </div>
          <div
            v-if="suggestedNewChapterTitle"
            class="rounded-md bg-(--ui-bg) px-3 py-2 font-medium text-(--ui-text-highlighted)"
          >
            {{ suggestedNewChapterTitle }}
          </div>
          <div
            v-if="newTitleSuggestionUsage"
            class="mt-2 text-[11px] text-(--ui-text-dimmed)"
          >
            {{ formatAiTitleUsage(newTitleSuggestionUsage) }}
          </div>
          <div
            v-if="suggestedNewChapterTitle"
            class="mt-3 flex justify-end gap-2"
          >
            <NButton
              size="tiny"
              quaternary
              :loading="generatingTitle"
              @click="aiGenerateNewTitle"
            >
              重新生成
            </NButton>
            <NButton
              size="tiny"
              type="primary"
              @click="applySuggestedNewChapterTitle"
            >
              采用
            </NButton>
          </div>
        </div>
        <NButton
          size="tiny"
          quaternary
          :loading="generatingTitle"
          @click="aiGenerateNewTitle"
        >
          <template #icon
            ><Icon
              icon="lucide:sparkles"
              class="w-3.5 h-3.5"
          /></template>
          AI 生成标题
        </NButton>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            size="small"
            @click="showNewChapterDialog = false"
            >取消</NButton
          >
          <NButton
            size="small"
            type="primary"
            :loading="creatingChapter"
            @click="createNewChapter"
            >创建</NButton
          >
        </div>
      </template>
    </NModal>

    <NModal
      v-model:show="showTitleSuggestion"
      preset="card"
      title="AI 生成章节名"
      style="max-width: 420px"
    >
      <div class="space-y-3">
        <div class="flex items-center gap-2 text-sm text-(--ui-text-dimmed)">
          <Icon
            icon="lucide:sparkles"
            class="h-4 w-4"
            :class="{ 'animate-spin': regeneratingTitle }"
          />
          <span>{{
            regeneratingTitle ? '正在生成章节名...' : '请选择是否采用这个章节名'
          }}</span>
        </div>
        <div
          v-if="suggestedTitle"
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) px-4 py-3 text-base font-medium text-(--ui-text-highlighted)"
        >
          {{ suggestedTitle }}
        </div>
        <div
          v-if="titleSuggestionUsage"
          class="text-[11px] text-(--ui-text-dimmed)"
        >
          {{ formatAiTitleUsage(titleSuggestionUsage) }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            size="small"
            @click="discardTitleSuggestion"
          >
            取消
          </NButton>
          <NButton
            size="small"
            :loading="regeneratingTitle"
            @click="aiRegenerateCurrentTitle"
          >
            重新生成
          </NButton>
          <NButton
            size="small"
            type="primary"
            :disabled="!suggestedTitle || regeneratingTitle"
            @click="applyTitleSuggestion"
          >
            采用
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- Deleted Chapters Dialog -->
    <NModal
      v-model:show="showDeletedChapters"
      preset="card"
      title="已删除的章节"
      style="max-width: 650px"
    >
      <div
        v-if="loadingDeleted"
        class="py-8 flex justify-center"
      >
        <NSpin size="medium" />
      </div>
      <div
        v-else-if="!deletedChapters.length"
        class="py-8 text-center text-sm text-(--ui-text-dimmed)"
      >
        没有已删除的章节
      </div>
      <NDataTable
        v-else
        :columns="deletedChapterColumns"
        :data="deletedChapters"
        :bordered="false"
        size="small"
        :max-height="400"
        :row-key="(row: any) => row.id"
      />
    </NModal>

    <!-- Deleted Chapter Preview -->
    <NModal
      v-model:show="showDeletedPreview"
      preset="card"
      :title="previewingDeletedChapter?.title || '预览'"
      style="max-width: 600px; max-height: 80vh"
    >
      <div
        v-if="previewingDeletedChapter"
        class="max-h-[60vh] overflow-y-auto rounded-lg bg-(--ui-bg-muted) p-4 text-sm leading-relaxed whitespace-pre-wrap text-(--ui-text)"
      >
        {{ previewingDeletedChapter.content }}
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.chapter-editor-shell {
  background:
    linear-gradient(rgba(255, 255, 255, 0.52) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px),
    linear-gradient(135deg, #f2f9ff 0%, #e3f2ff 48%, #f8fcff 100%);
  background-size:
    28px 28px,
    28px 28px,
    auto;
}

:root.dark .chapter-editor-shell {
  background:
    linear-gradient(rgba(56, 189, 248, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px),
    linear-gradient(135deg, #08111f 0%, #0b1d32 46%, #07111f 100%);
  background-size:
    28px 28px,
    28px 28px,
    auto;
}

.editor-canvas {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.54),
      rgba(240, 249, 255, 0.34)
    ),
    linear-gradient(
      135deg,
      rgba(186, 230, 253, 0.28),
      rgba(224, 242, 254, 0.18)
    );
  border-radius: 1rem;
  padding: clamp(0.75rem, 1.6vw, 1.35rem);
  box-shadow:
    inset 0 0 0 1px rgba(186, 230, 253, 0.62),
    0 16px 48px rgba(14, 116, 144, 0.08),
    0 2px 10px rgba(15, 23, 42, 0.04);
  transition:
    box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  border: none;
}

.editor-canvas:focus-within {
  box-shadow:
    inset 0 0 0 1px rgba(56, 189, 248, 0.7),
    0 18px 54px rgba(14, 116, 144, 0.12),
    0 4px 16px rgba(15, 23, 42, 0.05);
}

:root.dark .editor-canvas {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.74), rgba(8, 28, 48, 0.54)),
    linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(30, 41, 59, 0.24));
  box-shadow:
    inset 0 0 0 1px rgba(14, 165, 233, 0.22),
    0 16px 48px rgba(0, 0, 0, 0.24),
    0 2px 10px rgba(0, 0, 0, 0.18);
}

:root.dark .editor-canvas:focus-within {
  box-shadow:
    inset 0 0 0 1px rgba(56, 189, 248, 0.38),
    0 18px 54px rgba(0, 0, 0, 0.28),
    0 4px 16px rgba(0, 0, 0, 0.2);
}

.chapter-writing-surface {
  display: flex;
  flex-direction: column;
  max-width: 62rem;
  margin: 0 auto;
  min-height: 100%;
  border: 1px solid rgba(186, 230, 253, 0.72);
  border-radius: 0.9rem;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98),
      rgba(255, 255, 255, 0.94)
    ),
    linear-gradient(90deg, rgba(14, 165, 233, 0.1) 0 1px, transparent 1px 100%);
  box-shadow:
    0 18px 42px rgba(14, 116, 144, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.86) inset;
}

:root.dark .chapter-writing-surface {
  border-color: rgba(14, 165, 233, 0.24);
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.96),
    rgba(15, 23, 42, 0.9)
  );
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.24),
    0 1px 0 rgba(125, 211, 252, 0.08) inset;
}

.chapter-writing-surface :deep(.milkdown) {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.chapter-writing-surface :deep(.ProseMirror) {
  flex: 1;
  width: 100%;
  max-width: none;
  padding: 0;
  color: var(--ui-text);
  background: transparent;
  font-family:
    'Noto Serif SC', 'Source Han Serif SC', Georgia, 'Times New Roman', serif;
  font-size: 1rem;
  line-height: 2;
  letter-spacing: 0.015em;
  caret-color: var(--ui-primary);
  outline: none;
}

.chapter-writing-surface :deep(.ProseMirror ::selection) {
  background: color-mix(in oklch, var(--ui-primary) 15%, transparent);
}

.chapter-writing-surface :deep(.ProseMirror p) {
  margin: 0 0 0.85rem;
  max-width: none;
  text-wrap: pretty;
  text-indent: 2em;
}

.chapter-writing-surface :deep(.ProseMirror p:first-child) {
  text-indent: 2em;
}

.chapter-writing-surface :deep(.ProseMirror h1),
.chapter-writing-surface :deep(.ProseMirror h2),
.chapter-writing-surface :deep(.ProseMirror h3) {
  margin: 1.5rem 0 0.8rem;
  color: var(--ui-text-highlighted);
  letter-spacing: 0;
  line-height: 1.4;
  font-family: var(--font-sans);
  text-indent: 0;
}

.chapter-writing-surface :deep(.ProseMirror h1) {
  font-size: 1.6rem;
}

.chapter-writing-surface :deep(.ProseMirror h2) {
  font-size: 1.3rem;
}

.chapter-writing-surface :deep(.ProseMirror blockquote) {
  margin: 1rem 0;
  border-left: 2px solid color-mix(in oklch, var(--ui-primary) 40%, transparent);
  padding: 0.5rem 0 0.5rem 1.2rem;
  color: var(--ui-text-toned);
  background: color-mix(in oklch, var(--ui-primary) 4%, transparent);
  border-radius: 0 0.5rem 0.5rem 0;
}

.chapter-writing-surface :deep(.ProseMirror-selectednode),
.chapter-writing-surface :deep(.ProseMirror-focused) {
  outline: none;
  box-shadow: none;
}

.chapter-writing-surface :deep(.ProseMirror:focus-visible) {
  box-shadow: none;
}

/* AI 操作中：隐藏光标，保持选区高亮 */
.chapter-writing-surface :deep(.ProseMirror[contenteditable='false']) {
  caret-color: transparent;
}

.chapter-writing-surface
  :deep(.ProseMirror[contenteditable='false'] ::selection) {
  background: color-mix(in oklch, var(--ui-primary) 20%, transparent);
}

@media (max-width: 768px) {
  .editor-canvas {
    border-radius: 0.5rem;
    padding: 0.5rem;
  }

  .chapter-writing-surface {
    border-radius: 0.65rem;
  }

  .chapter-writing-surface :deep(.ProseMirror) {
    font-size: 0.94rem;
    line-height: 1.9;
  }

  .chapter-writing-surface :deep(.ProseMirror p) {
    max-width: none;
  }
}
</style>

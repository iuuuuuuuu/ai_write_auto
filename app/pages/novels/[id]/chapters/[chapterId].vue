<script setup lang="ts">
definePageMeta({ layout: 'default', pageTransition: false })

import { h } from 'vue'
import { computeLineDiff, type DiffLine } from '../../../../utils/diff'
import type { DraftRecoveryType } from '../../../../composables/useDraftRecovery'

const { t } = useI18n()
const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const chapterId = computed(() => Number(route.params.chapterId))
const { updateActiveTabTitle } = useTabs('user')

function getNovelTo() {
  return {
    path: `/novels/${novelId.value}`
  }
}

/* ─────────────── 左侧边栏状态 ─────────────── */
const leftSidebarTab = ref<'chapters' | 'characters' | 'versions' | 'notes'>('chapters')
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

watch(() => chapterNote.value, (note) => {
  if (note) noteContent.value = note.content || ''
}, { immediate: true })

async function saveNote() {
  if (savingNote.value) return
  savingNote.value = true
  try {
    await $fetch(`/api/novels/${novelId.value}/chapters/${chapterId.value}/notes`, {
      method: 'PUT',
      body: { content: noteContent.value }
    })
    await refreshChapterNote()
  } catch (e: any) {
    message.error(e?.data?.message || '笔记保存失败')
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

const { data: allChapters } = await useFetch<Array<ChapterListItem>>(
  `/api/novels/${novelId.value}/chapters`
)

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
  updatedAt?: string
}

type AiStreamPayload = Partial<{
  content: string
  done: boolean
  error: string
}>

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

const { data: novelInfo } = await useFetch<{ title: string }>(
  `/api/novels/${novelId.value}`,
  { pick: ['title'] }
)
const { data: aiConfigs } = await useFetch<
  Array<{
    id: number
    name: string
    purpose: string
    model: string
    isDefault: boolean
    enabled: boolean
  }>
>('/api/ai/config', { default: () => [] })
const { data: preferences } = await useFetch<Record<string, string>>('/api/settings/preferences', {
  default: () => ({})
})
const { aiStatus, refresh: refreshAiStatus } = useAiConnectivity()
const { recordReading } = useReadingHistory()

watch(
  [() => chapter.value, () => novelInfo.value],
  ([ch, novel]) => {
    if (ch) {
      const prefix = novel?.title ? `${novel.title} · ` : ''
      updateActiveTabTitle(`${prefix}Ch.${ch.chapterNumber} ${ch.title}`)
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
const showGenerateDialog = ref(false)
const generateDirection = ref('')
const selectedAiConfigId = ref<number | undefined>()
const zenMode = ref(false)
const showShortcutHelp = ref(false)
const conflictDetected = ref(false)
const serverUpdatedAt = ref(chapter.value?.updatedAt || null)

const showFloatingToolbar = ref(false)
const floatingToolbarPos = reactive({ x: 0, y: 0 })
const selectedText = ref('')
const expandingOrRewriting = ref(false)
const aiActionResult = ref('')
const aiActionType = ref<'expand' | 'rewrite' | 'continue' | null>(null)

/* ─────────────── 中断草稿恢复 ─────────────── */
const {
  draftRecovery,
  loadDraftRecovery,
  saveDraftRecovery,
  clearDraftRecovery
} = useDraftRecovery(novelId, chapterId)

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

watch(generatedContent, (val) => {
  if (generating.value && val) {
    saveDraftRecovery(val, 'generate')
  }
})

watch(aiActionResult, (val) => {
  if (expandingOrRewriting.value && val && aiActionType.value) {
    saveDraftRecovery(val, aiActionType.value)
  }
})

/* ─────────────── Milkdown 编辑器 ─────────────── */
const {
  containerRef: editorContainerRef,
  isReady: editorReady,
  createEditor,
  setMarkdown: setEditorMarkdown,
  getMarkdown: getEditorMarkdown,
  getPlainText: getEditorPlainText,
  getSelectionText: getEditorSelectionText,
  replaceSelection: replaceEditorSelection,
  insertTextAtCursor: insertEditorTextAtCursor,
  focus: focusEditor,
  getCursorClientPos,
  getContextBeforeCursor
} = useMilkdownEditor({
  onChange: (md) => {
    content.value = md
  }
})

/* ─────────────── 角色 ─────────────── */
const { data: allCharacters, refresh: refreshAllCharacters } = await useFetch<
  Array<{
    id: number
    name: string
    description: string | null
    traits: string | null
  }>
>(`/api/novels/${novelId.value}/characters`)

const detectedCharacterIds = ref<Set<number>>(new Set())
const extractingChars = ref(false)
const selectedCharacterIds = ref<Set<number>>(new Set())
const savingChapterCharacters = ref(false)
const aiExtractingCharacters = ref(false)
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
    }
    nextTick(detectCharactersFromContent)
    scrollCurrentChapterIntoView()
  }
)

onMounted(async () => {
  await createEditor(content.value)
  loadDraftRecovery()
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
}

function applyDetectedCharacters() {
  selectedCharacterIds.value = new Set(detectedCharacterIds.value)
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

/* ─────────────── 编辑器插入角色 ─────────────── */
function insertCharacterName(name: string) {
  insertEditorTextAtCursor(name)
  nextTick(() => focusEditor())
}
const generationModelOptions = computed(() =>
  aiConfigs.value
    .filter((config) => config.purpose === 'generation' && config.enabled)
    .map((config) => ({
      label: config.isDefault ? `${config.name} · 默认` : config.name,
      value: config.id,
      description: config.model
    }))
)

const selectedGenerationConfig = computed(() => {
  return aiConfigs.value.find((config) => config.id === selectedAiConfigId.value)
})

const plainTextContent = computed(() => content.value.replace(/[#>*_`\-[\]()]/g, '').trim())
const currentWordCount = computed(() => plainTextContent.value.replace(/\s/g, '').length)
const currentLineCount = computed(() => content.value ? content.value.split('\n').length : 0)
const chapterGoal = computed(() => Number(preferences.value.writing_chapter_goal || 3000))
const chapterProgress = computed(() => {
  if (chapterGoal.value <= 0) return 0
  return Math.min(Math.round((currentWordCount.value / chapterGoal.value) * 100), 100)
})
const saveStatusText = computed(() => {
  if (conflictDetected.value) return '保存冲突'
  if (saving.value) return '保存中...'
  if (content.value !== chapter.value?.content) return '待保存'
  if (lastSaved.value) return `已保存 ${lastSaved.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  return '已同步'
})
const saveStatusClass = computed(() => {
  if (conflictDetected.value) return 'text-red-500'
  if (saving.value || content.value !== chapter.value?.content) return 'text-amber-500'
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
      selectedAiConfigId.value = options[0]?.value
    }
  },
  { immediate: true }
)

let saveTimeout: ReturnType<typeof setTimeout> | null = null

watch(content, () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(autoSave, 3000)
})

async function autoSave() {
  if (content.value === chapter.value?.content) return
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
    conflictDetected.value = false
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 409
    ) {
      conflictDetected.value = true
    }
  } finally {
    saving.value = false
  }
}

function handleTextSelect() {
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
    const cursorPos = getCursorClientPos()
    if (cursorPos) {
      floatingToolbarPos.x = cursorPos.x
      floatingToolbarPos.y = cursorPos.y - 10
      showFloatingToolbar.value = true
    } else {
      showFloatingToolbar.value = false
    }
  }
}

async function doAiAction(type: 'expand' | 'rewrite' | 'continue') {
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

  try {
    const body: Record<string, unknown> = {
      novelId: novelId.value,
      chapterId: chapterId.value,
      aiConfigId: selectedAiConfigId.value
    }
    if (type === 'continue') {
      body.contextBefore = getContextBeforeCursor()
    } else {
      body.selectedText = selectedText.value
    }

    const response = await fetch(`/api/ai/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`AI 请求失败：${response.status}`)
    }
    if (!response.body) {
      throw new Error('AI 响应为空')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6)) as AiStreamPayload
          if (data.error) throw new Error(data.error)
          if (data.content) aiActionResult.value += data.content
          if (data.done) break
        } catch (error: unknown) {
          throw new Error(getErrorMessage(error))
        }
      }
    }
  } catch (error: unknown) {
    aiActionResult.value = getErrorMessage(error)
  } finally {
    expandingOrRewriting.value = false
  }
}

const showFragmentMenu = ref(false)

async function doFragment(type: 'dialogue' | 'description' | 'action' | 'monologue') {
  if (!aiStatus.value.available) {
    aiActionResult.value = aiStatus.value.reason || 'AI 当前不可用，仍可手动写作'
    aiActionType.value = 'continue'
    return
  }
  showFloatingToolbar.value = false
  showFragmentMenu.value = false
  expandingOrRewriting.value = true
  aiActionResult.value = ''
  aiActionType.value = 'continue'

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
      })
    })

    if (!response.ok) {
      throw new Error(`AI 请求失败：${response.status}`)
    }
    if (!response.body) {
      throw new Error('AI 响应为空')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6)) as AiStreamPayload
          if (data.error) throw new Error(data.error)
          if (data.content) aiActionResult.value += data.content
          if (data.done) break
        } catch (error: unknown) {
          throw new Error(getErrorMessage(error))
        }
      }
    }
  } catch (error: unknown) {
    aiActionResult.value = getErrorMessage(error)
  } finally {
    expandingOrRewriting.value = false
  }
}

const trackChangesDiff = computed<DiffLine[]>(() => {
  if (aiActionType.value !== 'rewrite' || !selectedText.value || !aiActionResult.value) return []
  return computeLineDiff(selectedText.value, aiActionResult.value)
})

function applyAiResult() {
  if (!aiActionResult.value) return
  if (aiActionType.value === 'continue') {
    insertEditorTextAtCursor(aiActionResult.value)
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

  generating.value = true
  generatedContent.value = ''
  showGenerateDialog.value = false

  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: novelId.value,
        chapterId: chapterId.value,
        direction: generateDirection.value || undefined,
        aiConfigId: selectedAiConfigId.value
      })
    })

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.content) generatedContent.value += data.content
          if (data.done) {
            await setEditorMarkdown(generatedContent.value)
            content.value = generatedContent.value
            await saveContent('ai_generated')
            await refreshChapter()
            clearDraftRecovery()
          }
        } catch {}
      }
    }
  } finally {
    generating.value = false
  }
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
    await Promise.all([refreshChapter(), refreshVersions()])
    content.value = version.content
    await setEditorMarkdown(version.content)
  } finally {
    rollingBack.value = false
  }
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
    const selection = getEditorSelectionText()
    if (selection.trim()) {
      selectedText.value = selection
      doAiAction('expand')
    }
    return
  }

  if (isShortcut(e, 'continue')) {
    e.preventDefault()
    if (!getEditorSelectionText().trim()) {
      doAiAction('continue')
    }
  }
}

/* ─────────────── 写作安全 ─────────────── */
const hasUnsavedChanges = computed(() => {
  return content.value !== (chapter.value?.content || '')
})

const editorPlainText = computed(() => getEditorPlainText())

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave((to, from, next) => {
  if (hasUnsavedChanges.value) {
    const answer = window.confirm(
      '当前章节有未保存的更改，离开将丢失修改。是否继续？'
    )
    if (answer) next()
    else next(false)
  } else {
    next()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (saveTimeout) clearTimeout(saveTimeout)
  if (detectTimeout) clearTimeout(detectTimeout)
})
</script>

<template>
  <div
    class="h-[calc(100vh-36px)] flex flex-col bg-(--ui-bg)"
    :class="{ 'fixed inset-0 z-50 !h-screen': zenMode }"
  >
    <!-- Toolbar -->
    <div
      v-if="!zenMode"
      class="flex items-center gap-2.5 px-4 h-12 border-b border-(--ui-border)/60 bg-(--ui-bg-muted)/60 backdrop-blur-md shrink-0"
    >
      <button
        class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/80 transition-colors"
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
          <p class="truncate text-sm font-medium text-(--ui-text-highlighted)">
            Ch.{{ chapter?.chapterNumber }} {{ chapter?.title }}
          </p>
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
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] tabular-nums text-(--ui-text-dimmed)">
          {{ editorPlainText.replace(/\s/g, '').length }}
          {{ t('chapter.wordCount') }}
        </span>
        <span
          v-if="saving"
          class="text-[11px] text-primary-500"
          >· 保存中</span
        >
        <span
          v-else-if="lastSaved"
          class="text-[11px] text-emerald-500"
          >· 已保存</span
        >
        <div class="w-px h-4 bg-(--ui-border)/40 mx-1" />
        <button
          class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/80 transition-colors"
          title="快捷键（Ctrl + /）"
          @click="showShortcutHelp = true"
        >
          <Icon
            icon="lucide:keyboard"
            class="w-3.5 h-3.5"
          />
        </button>
        <button
          class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/80 transition-colors"
          @click="zenMode = true"
        >
          <Icon
            icon="lucide:maximize"
            class="w-3.5 h-3.5"
          />
        </button>
        <div
          v-if="!aiStatus.available"
          class="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600"
          title="AI 当前不可用，仍可手动写作"
        >
          <Icon
            icon="lucide:wifi-off"
            class="w-3 h-3"
          />
          AI 离线
          <button
            class="text-[11px] underline underline-offset-2"
            @click="refreshAiStatus"
          >
            重试
          </button>
        </div>
        <NButton
          size="tiny"
          quaternary
          :loading="generating"
          :disabled="!aiStatus.available"
          @click="showGenerateDialog = true"
        >
          <template #icon>
            <Icon icon="lucide:sparkles" />
          </template>
        </NButton>
        <NButton
          size="tiny"
          type="primary"
          :loading="saving"
          @click="saveContent"
        >
          <template #icon>
            <Icon icon="lucide:save" />
          </template>
        </NButton>
      </div>
    </div>

    <!-- Zen Mode Exit -->
    <div
      v-if="zenMode"
      class="absolute top-4 right-4 z-10 opacity-0 hover:opacity-100 transition-opacity duration-300"
    >
      <button
        class="flex items-center justify-center w-9 h-9 rounded-xl card-glass text-(--ui-text-muted) hover:text-(--ui-text) transition-colors"
        @click="zenMode = false"
      >
        <Icon
          icon="lucide:minimize"
          class="w-4 h-4"
        />
      </button>
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
    <div class="flex-1 overflow-hidden flex">
      <!-- Left Sidebar -->
      <div
        v-if="!zenMode"
        class="shrink-0 border-r border-(--ui-border)/40 flex flex-col transition-all duration-200"
        :class="sidebarCollapsed ? 'w-10' : 'w-72'"
      >
        <!-- Collapse toggle -->
        <button
          class="flex items-center justify-center h-8 border-b border-(--ui-border)/40 text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/60 transition-colors"
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
            <div class="flex rounded-md bg-(--ui-bg-muted)/60 p-0.5 gap-0.5">
              <button
                class="flex-1 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'chapters' ?
                    'bg-(--ui-bg-elevated) text-(--ui-text-highlighted) shadow-sm'
                  : 'text-(--ui-text-muted) hover:text-(--ui-text)'
                "
                @click="leftSidebarTab = 'chapters'"
              >
                章节
              </button>
              <button
                class="flex-1 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'characters' ?
                    'bg-(--ui-bg-elevated) text-(--ui-text-highlighted) shadow-sm'
                  : 'text-(--ui-text-muted) hover:text-(--ui-text)'
                "
                @click="leftSidebarTab = 'characters'"
              >
                角色
              </button>
              <button
                class="flex-1 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'versions' ?
                    'bg-(--ui-bg-elevated) text-(--ui-text-highlighted) shadow-sm'
                  : 'text-(--ui-text-muted) hover:text-(--ui-text)'
                "
                @click="leftSidebarTab = 'versions'"
              >
                版本
              </button>
              <button
                class="flex-1 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  leftSidebarTab === 'notes' ?
                    'bg-(--ui-bg-elevated) text-(--ui-text-highlighted) shadow-sm'
                  : 'text-(--ui-text-muted) hover:text-(--ui-text)'
                "
                @click="leftSidebarTab = 'notes'"
              >
                笔记
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
              </div>
            </div>

            <div
              ref="chapterListRef"
              class="flex-1 overflow-y-auto px-2 pb-2 space-y-1"
            >
              <button
                v-for="ch in filteredChapters"
                :key="ch.id"
                :ref="(el) => setChapterButtonRef(ch.id, el)"
                class="w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors group"
                :class="
                  ch.id === chapterId ?
                    'bg-(--ui-primary-100)/10 text-(--ui-primary-600) dark:text-(--ui-primary-400) border border-(--ui-primary-500)/20'
                  : 'hover:bg-(--ui-bg-elevated)/60 text-(--ui-text-muted)'
                "
                @click="goToChapter(ch.id)"
              >
                <div class="flex items-center gap-1.5">
                  <span
                    class="text-[10px] font-mono shrink-0 w-8 text-right"
                    :class="
                      ch.id === chapterId ?
                        'text-(--ui-primary-500)'
                      : 'text-(--ui-text-dimmed)'
                    "
                    >Ch.{{ ch.chapterNumber }}</span
                  >
                  <span class="truncate flex-1 font-medium">{{
                    ch.title
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
              class="rounded-md border border-(--ui-border)/30 bg-(--ui-bg-muted)/30 p-2"
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
                还没有配置本章出现角色
              </p>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] text-(--ui-text-dimmed)">
                  正文检测 {{ detectedCharacters.length }} 位
                </span>
                <div class="flex items-center gap-1">
                  <button
                    class="inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated)/60 hover:text-(--ui-text) transition-colors disabled:opacity-60"
                    :disabled="aiExtractingCharacters"
                    @click="extractCharactersWithAi"
                  >
                    <Icon
                      icon="lucide:sparkles"
                      class="w-3 h-3"
                      :class="{ 'animate-pulse': aiExtractingCharacters }"
                    />
                    AI识别
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

              <button
                v-for="char in detectedCharacters"
                :key="char.id"
                type="button"
                class="w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-(--ui-bg-elevated)/60 group border border-transparent hover:border-(--ui-border)/30"
                @click="toggleChapterCharacter(char.id)"
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
                    <p
                      class="font-semibold text-(--ui-text-highlighted) truncate"
                    >
                      {{ char.name }}
                    </p>
                    <p
                      v-if="char.description"
                      class="text-[10px] text-(--ui-text-dimmed) truncate leading-tight"
                    >
                      {{ char.description }}
                    </p>
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
              </button>

              <div
                v-if="!detectedCharacters.length"
                class="text-center py-5 text-xs text-(--ui-text-dimmed)"
              >
                <div class="flex flex-col items-center gap-1">
                  <Icon
                    icon="lucide:users"
                    class="w-5 h-5 opacity-40"
                  />
                  <p>未检测到角色</p>
                  <p class="text-[10px] opacity-60">
                    正文中出现角色名后会自动显示
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="allCharacters?.length"
              class="pt-2 border-t border-(--ui-border)/20"
            >
              <p class="text-[10px] text-(--ui-text-dimmed) mb-1.5">全部角色</p>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="char in allCharacters"
                  :key="char.id"
                  type="button"
                  class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] transition-colors cursor-pointer"
                  :class="
                    selectedCharacterIds.has(char.id) ?
                      'bg-(--ui-primary-500)/10 text-(--ui-primary-500)'
                    : 'bg-(--ui-bg-muted) text-(--ui-text-muted) hover:bg-(--ui-bg-elevated)/80 hover:text-(--ui-text)'
                  "
                  @click="toggleChapterCharacter(char.id)"
                >
                  {{ char.name }}
                </button>
              </div>
            </div>
          </div>
        </template>
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
          class="rounded-md border border-(--ui-border)/20 bg-(--ui-bg-muted)/30 p-2 text-xs transition-colors hover:border-(--ui-border)/40"
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
          <div class="flex items-center gap-1">
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
          <span v-if="savingNote" class="text-[10px] text-(--ui-text-dimmed)">
            <NSpin size="tiny" class="inline-block mr-1" />
            保存中...
          </span>
          <span v-else-if="chapterNote?.updatedAt" class="text-[10px] text-(--ui-text-dimmed)">
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

      <!-- Editor -->
      <div class="flex-1 min-h-0 flex flex-col">
        <div class="flex-1 overflow-y-auto px-6 py-6">
        <div class="max-w-3xl mx-auto">
          <div
            ref="editorContainerRef"
            class="w-full min-h-[calc(100vh-160px)] milkdown-editor text-(--ui-text) text-[15px] leading-[2]"
            :class="zenMode ? 'text-base leading-[2.2]' : ''"
            @mouseup="handleTextSelect"
          />
        </div>

        <!-- AI Action Result -->
        <div
          v-if="aiActionResult"
          class="max-w-3xl mx-auto mt-4 p-4 card-surface border-l-2 border-l-primary-400"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span
                class="size-1.5 rounded-full bg-primary-400 animate-pulse"
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
            </div>
            <div class="flex gap-1">
              <NButton
                size="tiny"
                type="primary"
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
          <!-- Track Changes Diff View for rewrite -->
          <div v-if="aiActionType === 'rewrite' && trackChangesDiff.length" class="space-y-0.5">
            <div
              v-for="(line, idx) in trackChangesDiff"
              :key="idx"
              class="flex items-start gap-2 text-sm leading-relaxed rounded px-1.5 py-0.5"
              :class="{
                'bg-red-500/8': line.type === 'remove',
                'bg-emerald-500/8': line.type === 'add',
              }"
            >
              <span class="shrink-0 text-[10px] font-mono mt-0.5 w-4 text-right" :class="{
                'text-red-500': line.type === 'remove',
                'text-emerald-500': line.type === 'add',
                'text-(--ui-text-dimmed)': line.type === 'same',
              }">
                {{ line.type === 'remove' ? '-' : line.type === 'add' ? '+' : ' ' }}
              </span>
              <span :class="{
                'text-red-600 dark:text-red-400 line-through opacity-70': line.type === 'remove',
                'text-emerald-600 dark:text-emerald-400': line.type === 'add',
                'text-(--ui-text-muted)': line.type === 'same',
              }">
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

        <!-- Generated Content Preview -->
        <div
          v-if="generating && generatedContent"
          class="max-w-3xl mx-auto mt-4 p-4 card-surface"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="size-1.5 rounded-full bg-violet-400 animate-pulse" />
            <p class="text-xs font-medium text-violet-500">
              {{ t('ai.generating') }}
            </p>
          </div>
          <div
            class="text-(--ui-text) whitespace-pre-wrap text-sm leading-relaxed"
          >
            {{ generatedContent }}
          </div>
        </div>

        <!-- Editor Status Bar -->
        <div
          v-if="!zenMode"
          class="shrink-0 border-t border-(--ui-border)/40 bg-(--ui-bg)/95 px-4 py-1.5 flex items-center justify-between gap-3 text-[11px] text-(--ui-text-dimmed)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="flex items-center gap-1">
              <Icon icon="lucide:type" class="size-3" />
              {{ currentWordCount.toLocaleString() }} 字
            </span>
            <span class="hidden sm:flex items-center gap-1">
              <Icon icon="lucide:target" class="size-3" />
              {{ chapterProgress }}%
            </span>
            <span class="hidden sm:flex items-center gap-1">
              <Icon icon="lucide:list" class="size-3" />
              {{ currentLineCount }} 行
            </span>
            <span class="hidden md:flex items-center gap-1" :class="saveStatusClass">
              <Icon :icon="conflictDetected ? 'lucide:triangle-alert' : saving ? 'lucide:loader-circle' : 'lucide:check-circle'" class="size-3" :class="saving ? 'animate-spin' : ''" />
              {{ saveStatusText }}
            </span>
          </div>

          <div class="flex items-center gap-2 min-w-0">
            <span class="hidden sm:inline">当前模型</span>
            <NSelect
              v-model:value="selectedAiConfigId"
              size="tiny"
              :options="generationModelOptions"
              placeholder="选择模型"
              class="w-44"
            />
            <span class="hidden lg:inline truncate max-w-48" :title="selectedGenerationConfig?.model">
              {{ selectedGenerationConfig?.model || '未选择' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Toolbar -->
    <Teleport to="body">
      <div
        v-if="showFloatingToolbar && !generating"
        class="fixed z-50 flex items-center gap-0.5 px-2 py-1.5 rounded-xl card-glass shadow-xl"
        :style="{
          left: `${floatingToolbarPos.x}px`,
          top: `${floatingToolbarPos.y}px`,
          transform: 'translate(-50%, -100%)'
        }"
      >
        <NButton
          v-if="selectedText"
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
        <NButton
          v-if="selectedText"
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
        <NButton
          v-if="!selectedText"
          size="tiny"
          quaternary
          :loading="expandingOrRewriting"
          :disabled="!aiStatus.available"
          @click="doAiAction('continue')"
        >
          <template #icon>
            <Icon icon="lucide:pen-line" />
          </template>
          {{ t('chapter.continue') }}
        </NButton>
        <NDropdown
          v-if="!selectedText"
          trigger="hover"
          :options="[
            { label: '对话', key: 'dialogue', icon: () => h(Icon, { icon: 'lucide:message-circle' }) },
            { label: '环境描写', key: 'description', icon: () => h(Icon, { icon: 'lucide:mountain' }) },
            { label: '动作场景', key: 'action', icon: () => h(Icon, { icon: 'lucide:swords' }) },
            { label: '内心独白', key: 'monologue', icon: () => h(Icon, { icon: 'lucide:brain' }) },
          ]"
          @select="(key) => doFragment(key as any)"
        >
          <NButton
            size="tiny"
            quaternary
            :loading="expandingOrRewriting"
            :disabled="!aiStatus.available"
          >
            <template #icon>
              <Icon icon="lucide:scissors" />
            </template>
            片段
          </NButton>
        </NDropdown>
      </div>
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
      style="max-width: 480px"
    >
      <div class="space-y-4">
        <NFormItem :label="t('chapter.generateDialog.direction')">
          <NInput
            v-model:value="generateDirection"
            type="textarea"
            :placeholder="t('chapter.generateDialog.directionPlaceholder')"
            :rows="3"
          />
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
        <NAlert
          v-if="!generationModelOptions.length"
          type="warning"
          title="还没有可用的内容生成模型"
        >
          请先到设置页创建并启用一个内容生成模型。
        </NAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showGenerateDialog = false">{{
            t('common.cancel')
          }}</NButton>
          <NButton
            type="primary"
            :disabled="!selectedAiConfigId || !aiStatus.available"
            @click="generateChapter"
          >
            <template #icon><Icon icon="lucide:sparkles" /></template>
            {{ t('chapter.generate') }}
          </NButton>
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
        class="max-h-[60vh] overflow-y-auto rounded border border-(--ui-border)/30 bg-(--ui-bg-muted)/30 p-3 text-xs leading-relaxed space-y-0.5"
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
  </div>
</template>

<script setup lang="ts">
import {
  cleanAiChapterTitle,
  formatAiTitleUsage,
  stripChapterNumberPrefix,
  type AiTitleUsage
} from '../../../utils/chapter-title'
import { getNovelGenreColor } from '~~/shared/novel-catalog'

definePageMeta({ layout: 'default' })

const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const message = useMessage()
const { post, put, del: apiDel } = useApi()
const { removeNovelHistory } = useReadingHistory()
const { tabs, updateActiveTabTitle, removeTab, activeTab, setActiveTab } =
  useTabs('user')
const { startStream } = useAiStream()

function closeAndGoHome() {
  const tabId = activeTab.value?.id
  setActiveTab('home')
  if (tabId) removeTab(tabId)
}

interface NovelDetail {
  id: number
  title: string
  description: string | null
  genre: string | null
  status: string
  wordCount: number | null
  styleGuide: string | null
  worldSetting: string | null
  aiTemperature: string | null
  aiTopP: string | null
  aiThinkingEnabled: boolean | null
  aiReasoningEffort: 'low' | 'medium' | 'high' | null
  aiExtraPrompt: string | null
  createdAt: string
  updatedAt: string
  aiConfigId: number | null
  aiConfigName: string | null
  aiConfigModel: string | null
  aiConfigOperational: boolean
}

interface ChapterItem {
  id: number
  chapterNumber: number
  title: string
  summary: string | null
  status: string
  wordCount: number | null
  updatedAt: string
}

interface CharacterAppearanceItem {
  id: number
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  role: 'main' | 'supporting' | 'mentioned'
  snippet: string | null
  background: string | null
  positionStart: number | null
  positionEnd: number | null
  createdAt: string | null
}

interface CharacterItem {
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
  overallArc: string | null
  firstAppearanceChapter: number | null
  lastAppearanceChapter: number | null
  createdAt: string
  appearances: CharacterAppearanceItem[]
}

type CharacterFormModel = Partial<{
  name: string
  realName: string
  displayTitle: string
  rolePosition: string
  storyRole: string
  description: string
  traits: string
  relationships: string
}>

type ChapterStatusFilter =
  | 'all'
  | 'draft'
  | 'generated'
  | 'edited'
  | 'final'
  | 'completed'

type CharacterAppearanceFilter = 'all' | 'appeared' | 'missing'

interface OutlineItem {
  id: number
  chapterNumber: number
  description: string
  sortOrder: number
}

interface OutlineFormItem {
  chapterNumber: number
  description: string
  sortOrder: number
}

interface PlotPointItem {
  id: number
  description: string
  type: 'setup' | 'conflict' | 'resolution' | 'twist'
  status: 'introduced' | 'developing' | 'resolved'
  chapterId: number | null
  createdAt: string
}

const { data: novel, refresh: refreshNovel } = await useFetch<NovelDetail>(
  `/api/novels/${novelId.value}`
)

const { data: aiConfigs } = await useFetch<
  Array<{
    id: number
    purpose: string
    enabled: boolean
    operational: boolean
    aiModel: {
      id: number
      name: string
      model: string
      enabled: boolean
      supportsThinking: boolean
    }
  }>
>('/api/ai/config', { default: () => [] })

const aiConfigOptions = computed(() => {
  return aiConfigs.value
    .filter((c) => c.purpose === 'generation' && c.enabled && c.operational)
    .map((c) => ({
      label: `${c.aiModel.name} (${c.aiModel.model})`,
      value: c.id
    }))
})

const showAiSettingsModal = shallowRef(false)
const savingAiSettings = shallowRef(false)
const aiSettingsForm = reactive({
  aiConfigId: null as number | null,
  aiTemperature: '',
  aiTopP: '',
  aiThinkingEnabled: null as boolean | null,
  aiReasoningEffort: null as 'low' | 'medium' | 'high' | null,
  aiExtraPrompt: '',
  worldSetting: '',
  styleGuide: ''
})

const selectedNovelAiConfig = computed(
  () =>
    aiConfigs.value.find((config) => config.id === aiSettingsForm.aiConfigId) ||
    null
)

const reasoningOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' }
] as const

function openAiSettings() {
  aiSettingsForm.aiConfigId = novel.value?.aiConfigId ?? null
  aiSettingsForm.aiTemperature = novel.value?.aiTemperature || ''
  aiSettingsForm.aiTopP = novel.value?.aiTopP || ''
  aiSettingsForm.aiThinkingEnabled = novel.value?.aiThinkingEnabled ?? null
  aiSettingsForm.aiReasoningEffort = novel.value?.aiReasoningEffort ?? null
  aiSettingsForm.aiExtraPrompt = novel.value?.aiExtraPrompt || ''
  aiSettingsForm.worldSetting = novel.value?.worldSetting || ''
  aiSettingsForm.styleGuide = novel.value?.styleGuide || ''
  showAiSettingsModal.value = true
}

async function saveAiSettings() {
  savingAiSettings.value = true
  try {
    await put(
      `/api/novels/${novelId.value}`,
      {
        aiConfigId: aiSettingsForm.aiConfigId,
        aiTemperature: aiSettingsForm.aiTemperature || undefined,
        aiTopP: aiSettingsForm.aiTopP || undefined,
        aiThinkingEnabled: aiSettingsForm.aiThinkingEnabled,
        aiReasoningEffort: aiSettingsForm.aiReasoningEffort,
        aiExtraPrompt: aiSettingsForm.aiExtraPrompt || undefined,
        worldSetting: aiSettingsForm.worldSetting || undefined,
        styleGuide: aiSettingsForm.styleGuide || undefined
      },
      { successMessage: 'AI 设定已保存' }
    )
    showAiSettingsModal.value = false
    await refreshNovel()
  } catch {
    // useApi handles error display
  } finally {
    savingAiSettings.value = false
  }
}

watch(
  () => novel.value,
  (n) => {
    if (n) updateActiveTabTitle(n.title)
  },
  { immediate: true }
)

const { data: chapters, refresh: refreshChapters } = await useFetch<
  ChapterItem[]
>(`/api/novels/${novelId.value}/chapters`, {
  immediate: !!novel.value,
  default: () => []
})
const { data: outlines, refresh: refreshOutlines } = await useFetch<
  OutlineItem[]
>(`/api/novels/${novelId.value}/outlines`, {
  immediate: !!novel.value,
  default: () => []
})
const { data: characters, refresh: refreshCharacters } = await useFetch<
  CharacterItem[]
>(`/api/novels/${novelId.value}/characters`, {
  immediate: !!novel.value,
  default: () => []
})
const { confirmDelete } = useConfirmDialog()

const showCharacterDialog = ref(false)
const showNewChapterDialog = ref(false)
const newChapterTitle = ref('')
const newChapterPosition = ref<'end' | 'before' | 'after'>('end')
const newChapterRefId = ref<number | null>(null)
const creatingChapter = ref(false)
const generatingChapterTitle = ref(false)
const suggestedChapterTitle = ref('')
const titleSuggestionUsage = ref<AiTitleUsage | null>(null)

const chapterPositionOptions = [
  { label: '添加到末尾', value: 'end' },
  { label: '插入到指定章节之前', value: 'before' },
  { label: '插入到指定章节之后', value: 'after' }
]
const chapterRefOptions = computed(() =>
  (chapters.value || []).map((c, i) => ({
    label: `第${i + 1}章 ${stripChapterNumberPrefix(c.title) || '未命名'}`,
    value: c.id
  }))
)

async function aiGenerateChapterTitle() {
  if (generatingChapterTitle.value) return
  generatingChapterTitle.value = true
  suggestedChapterTitle.value = ''
  titleSuggestionUsage.value = null
  try {
    const nextNum = (chapters.value?.length || 0) + 1
    const lastChapter = chapters.value?.[chapters.value.length - 1]
    const result = await $fetch<{ title: string; usage?: AiTitleUsage }>(
      '/api/ai/suggest-title',
      {
        method: 'POST',
        body: {
          novelId: novelId.value,
          chapterNumber: nextNum,
          previousChapterTitle: lastChapter?.title || undefined,
          aiConfigId: novel.value?.aiConfigId || undefined
        }
      }
    )
    const cleaned = cleanAiChapterTitle(result.title)
    if (cleaned) {
      suggestedChapterTitle.value = cleaned
      titleSuggestionUsage.value = result.usage || null
    } else {
      message.warning('AI 未能生成有效标题')
    }
  } catch {
    message.error('生成章节名失败')
  } finally {
    generatingChapterTitle.value = false
  }
}

function applySuggestedChapterTitle() {
  if (!suggestedChapterTitle.value) return
  newChapterTitle.value = suggestedChapterTitle.value
  suggestedChapterTitle.value = ''
  titleSuggestionUsage.value = null
}
const editingCharacterId = ref<number | null>(null)
const savingCharacter = ref(false)
const enrichingCharacter = ref(false)
const characterFormRef = ref<{ validate: () => Promise<void> } | null>(null)
const chapterSearchQuery = shallowRef('')
const chapterStatusFilter = shallowRef<ChapterStatusFilter>('all')
const editingOutlines = shallowRef(false)
const savingOutlines = shallowRef(false)
const outlineFormItems = ref<OutlineFormItem[]>([])
const outlineSearchQuery = shallowRef('')
const plotPointSearchQuery = shallowRef('')
const foreshadowingRefreshKey = shallowRef(0)
const characterSearchQuery = shallowRef('')
const characterAppearanceFilter = shallowRef<CharacterAppearanceFilter>('all')
const expandedCharacterIds = shallowRef<number[]>([])
const characterViewMode = shallowRef<'cards' | 'graph'>('cards')
const characterForm = reactive<CharacterFormModel>({
  name: '',
  realName: '',
  displayTitle: '',
  rolePosition: '',
  storyRole: '',
  description: '',
  traits: '',
  relationships: ''
})

// Setup guide
const setupGuideDismissed = ref(false)
const setupStep1Done = computed(
  () => !!(novel.value?.worldSetting || novel.value?.styleGuide)
)
const setupStep2Done = computed(() => (characters.value?.length || 0) > 0)
const setupStep3Done = computed(() => (outlines.value?.length || 0) > 0)
const showSetupGuide = computed(() => {
  if (setupGuideDismissed.value) return false
  if (!novel.value) return false
  if ((chapters.value?.length || 0) > 0) return false
  return !setupStep1Done.value || !setupStep2Done.value || !setupStep3Done.value
})

function dismissSetupGuide() {
  setupGuideDismissed.value = true
}

async function deleteNovel() {
  const confirmed = await confirmDelete(novel.value?.title || '此小说')
  if (!confirmed) return
  await $fetch(`/api/novels/${novelId.value}`, { method: 'DELETE' })
  removeNovelHistory(novelId.value)
  // 关闭所有指向该小说的标签页（详情/章节/工作区/阅读），并切回首页，
  // 避免删除后残留指向已不存在小说的死标签。
  setActiveTab('home')
  const prefix = `/novels/${novelId.value}`
  for (const tab of tabs.value.filter(
    (t) => t.closable && (t.path === prefix || t.path.startsWith(`${prefix}/`))
  )) {
    removeTab(tab.id)
  }
}

const statusLabel = computed(() => {
  const s = novel.value?.status
  if (s === 'completed') return '已完结'
  if (s === 'in_progress') return '连载中'
  return '草稿'
})

const statusColor = computed(() => {
  const s = novel.value?.status
  if (s === 'completed') return 'success'
  if (s === 'in_progress') return 'info'
  return 'default'
})

const genreColor = (genre: string | null) => getNovelGenreColor(genre)

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase()
}

function getChapterStatusLabel(status: string) {
  if (status === 'final') return '已定稿'
  if (status === 'generated') return '已生成'
  if (status === 'edited') return '已编辑'
  if (status === 'completed') return '已完成'
  return '草稿'
}

function getChapterStatusType(status: string) {
  if (status === 'final' || status === 'completed') return 'success'
  if (status === 'generated') return 'info'
  if (status === 'edited') return 'warning'
  return 'default'
}

function getChapterStatusCount(status: string) {
  return (
    chapters.value?.filter((chapter) => chapter.status === status).length || 0
  )
}

function clearChapterFilters() {
  chapterSearchQuery.value = ''
  chapterStatusFilter.value = 'all'
}

const sortedOutlines = computed(() => {
  // 主按章号排序：大纲条目本质是「第N章的大纲」，按章号排序最直观；
  // 也保证生成流程自动补全的大纲（不一定带连续 sortOrder）能正确插入到对应章号位置。
  return [...(outlines.value || [])].sort((left, right) => {
    return (
      left.chapterNumber - right.chapterNumber ||
      left.sortOrder - right.sortOrder
    )
  })
})

const filteredOutlines = computed(() => {
  const query = normalizeSearchText(outlineSearchQuery.value)
  if (!query) return sortedOutlines.value
  return sortedOutlines.value.filter((outline) => {
    const searchable = normalizeSearchText(
      `${outline.chapterNumber} ${outline.description}`
    )
    return searchable.includes(query)
  })
})

const filteredPlotPoints = computed(() => {
  const query = normalizeSearchText(plotPointSearchQuery.value)
  if (!query) return plotPoints.value || []
  return (plotPoints.value || []).filter((point) => {
    const chapterInfo = chapters.value?.find((c) => c.id === point.chapterId)
    const searchable = normalizeSearchText(
      `${point.description} ${getPlotPointTypeLabel(point.type)} ${chapterInfo?.chapterNumber || ''} ${chapterInfo?.title || ''}`
    )
    return searchable.includes(query)
  })
})

function resetOutlineFormItems() {
  outlineFormItems.value = sortedOutlines.value.map((outline, index) => ({
    chapterNumber: outline.chapterNumber,
    description: outline.description,
    sortOrder: outline.sortOrder ?? index
  }))
}

function startEditOutlines() {
  resetOutlineFormItems()
  editingOutlines.value = true
}

function cancelEditOutlines() {
  editingOutlines.value = false
  resetOutlineFormItems()
}

function addOutlineItem() {
  const nextChapterNumber = outlineFormItems.value.length + 1
  outlineFormItems.value = [
    ...outlineFormItems.value,
    {
      chapterNumber: nextChapterNumber,
      description: '',
      sortOrder: nextChapterNumber - 1
    }
  ]
}

function removeOutlineItem(index: number) {
  outlineFormItems.value = outlineFormItems.value
    .filter((_, itemIndex) => itemIndex !== index)
    .map((item, itemIndex) => ({
      ...item,
      sortOrder: itemIndex
    }))
}

const draggingOutlineIndex = ref<number | null>(null)

function handleOutlineDragStart(index: number) {
  draggingOutlineIndex.value = index
}

function handleOutlineDragOver(event: DragEvent, index: number) {
  event.preventDefault()
  if (
    draggingOutlineIndex.value === null ||
    draggingOutlineIndex.value === index
  )
    return
  const items = [...outlineFormItems.value]
  const [moved] = items.splice(draggingOutlineIndex.value, 1)
  items.splice(index, 0, moved!)
  outlineFormItems.value = items.map((item, i) => ({
    ...item,
    sortOrder: i
  }))
  draggingOutlineIndex.value = index
}

function handleOutlineDragEnd() {
  draggingOutlineIndex.value = null
}

// Chapter drag-and-drop reorder
const chapterReorderMode = ref(false)
const draggingChapterIndex = ref<number | null>(null)
const savingChapterOrder = ref(false)

// Chapter 批量选择删除
const dialog = useDialog()
const chapterSelectMode = ref(false)
const selectedChapterIds = ref<number[]>([])

function toggleChapterSelectMode() {
  chapterSelectMode.value = !chapterSelectMode.value
  selectedChapterIds.value = []
  if (chapterSelectMode.value) chapterReorderMode.value = false
}

function toggleChapterSelection(id: number) {
  const i = selectedChapterIds.value.indexOf(id)
  if (i >= 0) selectedChapterIds.value.splice(i, 1)
  else selectedChapterIds.value.push(id)
}

const allChaptersSelected = computed(
  () =>
    filteredChapters.value.length > 0 &&
    selectedChapterIds.value.length === filteredChapters.value.length
)

function toggleSelectAllChapters() {
  selectedChapterIds.value =
    allChaptersSelected.value ? [] : filteredChapters.value.map((c) => c.id)
}

function confirmBatchDeleteChapters() {
  if (!selectedChapterIds.value.length) return
  dialog.warning({
    title: '批量删除章节',
    content: `确定要删除选中的 ${selectedChapterIds.value.length} 个章节吗？删除后可在回收站恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      const ids = [...selectedChapterIds.value]
      await Promise.all(
        ids.map((id) =>
          apiDel(`/api/novels/${novelId.value}/chapters/${id}`, {
            silent: true
          }).catch(() => {})
        )
      )
      message.success(`已删除 ${ids.length} 个章节`)
      chapterSelectMode.value = false
      selectedChapterIds.value = []
      await Promise.all([
        refreshChapters(),
        refreshCharacters(),
        refreshPlotPoints()
      ])
      foreshadowingRefreshKey.value += 1
    }
  })
}

function handleChapterDragStart(index: number) {
  draggingChapterIndex.value = index
}

function handleChapterDragOver(event: DragEvent, index: number) {
  event.preventDefault()
  if (
    draggingChapterIndex.value === null ||
    draggingChapterIndex.value === index
  )
    return
  const items = [...(chapters.value || [])]
  const [moved] = items.splice(draggingChapterIndex.value, 1)
  items.splice(index, 0, moved!)
  chapters.value = items
  draggingChapterIndex.value = index
}

function handleChapterDragEnd() {
  draggingChapterIndex.value = null
}

async function saveChapterOrder() {
  if (!chapters.value?.length) return
  savingChapterOrder.value = true
  try {
    const orderedIds = chapters.value.map((c) => c.id)
    await put(
      `/api/novels/${novelId.value}/chapters/reorder`,
      { orderedIds },
      { successMessage: '章节顺序已保存' }
    )
    chapters.value = chapters.value.map((c, i) => ({
      ...c,
      chapterNumber: i + 1
    }))
    chapterReorderMode.value = false
  } catch {
    // useApi handles error display
  } finally {
    savingChapterOrder.value = false
  }
}

async function createNewChapter() {
  creatingChapter.value = true
  try {
    const body: Record<string, unknown> = {
      title: newChapterTitle.value.trim()
    }
    if (newChapterPosition.value !== 'end' && newChapterRefId.value) {
      body.position = newChapterPosition.value
      body.refChapterId = newChapterRefId.value
    }
    const result = await post<{ id: number }>(
      `/api/novels/${novelId.value}/chapters`,
      body
    )
    showNewChapterDialog.value = false
    navigateTo(`/novels/${novelId.value}/chapters/${result.id}`)
  } catch {
    // useApi handles error display
  } finally {
    creatingChapter.value = false
  }
}

function openNewChapterDialog() {
  newChapterTitle.value = ''
  newChapterPosition.value = 'end'
  newChapterRefId.value =
    chapters.value?.length ?
      chapters.value[chapters.value.length - 1]!.id
    : null
  suggestedChapterTitle.value = ''
  titleSuggestionUsage.value = null
  showNewChapterDialog.value = true
}

function getValidOutlineItems() {
  return outlineFormItems.value
    .map((item, index) => ({
      chapterNumber: item.chapterNumber,
      description: item.description.trim(),
      sortOrder: index
    }))
    .filter((item) => item.chapterNumber > 0 && item.description.length > 0)
}

async function saveOutlines() {
  const validOutlines = getValidOutlineItems()
  if (!validOutlines.length) {
    message.warning('请至少填写一条章节大纲')
    return
  }

  savingOutlines.value = true
  try {
    await put(
      `/api/novels/${novelId.value}/outlines`,
      { outlines: validOutlines },
      { successMessage: '大纲已保存' }
    )
    editingOutlines.value = false
    await refreshOutlines()
    resetOutlineFormItems()
  } catch {
    // useApi handles error display
  } finally {
    savingOutlines.value = false
  }
}

watch(
  sortedOutlines,
  () => {
    if (!editingOutlines.value) {
      resetOutlineFormItems()
    }
  },
  { immediate: true }
)

function clearCharacterFilters() {
  characterSearchQuery.value = ''
  characterAppearanceFilter.value = 'all'
}

function getCharacterAppearanceCount(character: CharacterItem) {
  return new Set(character.appearances.map((item) => item.chapterId)).size
}

function getCharacterInitial(character: CharacterItem) {
  return character.name.trim().charAt(0) || '角'
}

function isCharacterExpanded(characterId: number) {
  return expandedCharacterIds.value.includes(characterId)
}

function toggleCharacterAppearances(characterId: number) {
  expandedCharacterIds.value =
    isCharacterExpanded(characterId) ?
      expandedCharacterIds.value.filter((id) => id !== characterId)
    : [...expandedCharacterIds.value, characterId]
}

const totalWords = computed(() => {
  return chapters.value?.reduce((sum, c) => sum + (c.wordCount || 0), 0) || 0
})

const sortedCharacters = computed(() => {
  return [...(characters.value || [])].sort((left, right) => {
    const leftChapter = left.firstAppearanceChapter ?? Number.MAX_SAFE_INTEGER
    const rightChapter = right.firstAppearanceChapter ?? Number.MAX_SAFE_INTEGER
    return leftChapter - rightChapter || left.name.localeCompare(right.name)
  })
})

const characterChapterCount = computed(() => {
  return sortedCharacters.value.reduce((count, character) => {
    return (
      count + new Set(character.appearances.map((item) => item.chapterId)).size
    )
  }, 0)
})

const latestChapter = computed(() => {
  return [...(chapters.value || [])].sort((left, right) => {
    return right.chapterNumber - left.chapterNumber
  })[0]
})

const nextOutline = computed(() => {
  const nextChapterNumber = (chapters.value?.length || 0) + 1
  return (
    sortedOutlines.value.find(
      (outline) => outline.chapterNumber >= nextChapterNumber
    ) || sortedOutlines.value.at(-1)
  )
})

const missingCharacterProfileCount = computed(() => {
  return sortedCharacters.value.filter((character) => {
    return !(
      character.realName &&
      character.displayTitle &&
      character.rolePosition &&
      character.storyRole
    )
  }).length
})

const writingPlanItems = computed(() => [
  {
    label: '大纲',
    value: `${sortedOutlines.value.length} 条`,
    description:
      sortedOutlines.value.length ?
        '可直接作为章节生成方向'
      : '建议先生成章节大纲',
    icon: 'lucide:list-tree',
    tone: sortedOutlines.value.length ? 'text-primary-500' : 'text-amber-500'
  },
  {
    label: '角色',
    value: `${sortedCharacters.value.length} 位`,
    description:
      missingCharacterProfileCount.value ?
        `${missingCharacterProfileCount.value} 位资料待补全`
      : '核心身份字段已补齐',
    icon: 'lucide:users',
    tone:
      missingCharacterProfileCount.value ? 'text-amber-500' : 'text-emerald-500'
  },
  {
    label: '线索',
    value: `${plotPoints.value?.length || 0} 个`,
    description:
      plotPoints.value?.length ? '可辅助追踪冲突与回收' : '可添加关键情节节点',
    icon: 'lucide:route',
    tone: plotPoints.value?.length ? 'text-blue-500' : 'text-(--ui-text-dimmed)'
  }
])

const chapterStatusOptions = computed(() => [
  { label: '全部状态', value: 'all' },
  { label: `草稿 ${getChapterStatusCount('draft')}`, value: 'draft' },
  { label: `已生成 ${getChapterStatusCount('generated')}`, value: 'generated' },
  { label: `已编辑 ${getChapterStatusCount('edited')}`, value: 'edited' },
  { label: `已定稿 ${getChapterStatusCount('final')}`, value: 'final' },
  { label: `已完成 ${getChapterStatusCount('completed')}`, value: 'completed' }
])

const characterAppearanceOptions = computed(() => [
  { label: '全部角色', value: 'all' },
  { label: '有出场记录', value: 'appeared' },
  { label: '无出场记录', value: 'missing' }
])

const filteredChapters = computed(() => {
  const list = chapters.value || []
  const query = normalizeSearchText(chapterSearchQuery.value)
  const statusFilter = chapterStatusFilter.value

  return list.filter((chapter) => {
    const statusMatched =
      statusFilter === 'all' || chapter.status === statusFilter
    if (!statusMatched) return false
    if (!query) return true

    const searchable = normalizeSearchText(
      `${chapter.chapterNumber} ${chapter.title} ${chapter.summary || ''} ${chapter.wordCount || 0} ${getChapterStatusLabel(chapter.status)}`
    )
    return searchable.includes(query)
  })
})

const chapterFilterText = computed(() => {
  const total = chapters.value?.length || 0
  if (!total) return '0 个章节'
  if (
    filteredChapters.value.length === total &&
    !chapterSearchQuery.value &&
    chapterStatusFilter.value === 'all'
  ) {
    return `${total} 个章节`
  }
  return `${filteredChapters.value.length} / ${total} 个章节`
})

const filteredCharacters = computed(() => {
  const query = normalizeSearchText(characterSearchQuery.value)
  const appearanceFilter = characterAppearanceFilter.value

  return sortedCharacters.value.filter((character) => {
    const hasAppearances = character.appearances.length > 0
    const appearanceMatched =
      appearanceFilter === 'all' ||
      (appearanceFilter === 'appeared' && hasAppearances) ||
      (appearanceFilter === 'missing' && !hasAppearances)
    if (!appearanceMatched) return false
    if (!query) return true

    const appearancesText = character.appearances
      .map((appearance) => {
        return `${appearance.chapterNumber} ${appearance.chapterTitle} ${appearance.background || ''} ${appearance.snippet || ''} ${getRoleLabel(appearance.role)}`
      })
      .join(' ')
    const searchable = normalizeSearchText(
      `${character.name} ${character.realName || ''} ${character.displayTitle || ''} ${character.rolePosition || ''} ${character.storyRole || ''} ${character.description || ''} ${character.traits || ''} ${character.currentState || ''} ${character.relationships || ''} ${character.firstAppearanceChapter || ''} ${character.lastAppearanceChapter || ''} ${appearancesText}`
    )
    return searchable.includes(query)
  })
})

const characterFilterText = computed(() => {
  const total = sortedCharacters.value.length
  if (!total) return '0 位角色'
  if (
    filteredCharacters.value.length === total &&
    !characterSearchQuery.value &&
    characterAppearanceFilter.value === 'all'
  ) {
    return `${total} 位角色 · ${characterChapterCount.value} 个章节出场记录`
  }
  return `${filteredCharacters.value.length} / ${total} 位角色`
})

const characterDialogTitle = computed(() => {
  return editingCharacterId.value ? '编辑角色' : '新增角色'
})

const editingCharacterData = computed(() => {
  if (!editingCharacterId.value) return null
  return (
    characters.value?.find(
      (c: CharacterItem) => c.id === editingCharacterId.value
    ) ?? null
  )
})

function resetCharacterForm() {
  editingCharacterId.value = null
  characterForm.name = ''
  characterForm.realName = ''
  characterForm.displayTitle = ''
  characterForm.rolePosition = ''
  characterForm.storyRole = ''
  characterForm.description = ''
  characterForm.traits = ''
  characterForm.relationships = ''
}

function openCreateCharacterDialog() {
  resetCharacterForm()
  showCharacterDialog.value = true
}

function openEditCharacterDialog(character: CharacterItem) {
  editingCharacterId.value = character.id
  characterForm.name = character.name
  characterForm.realName = character.realName || ''
  characterForm.displayTitle = character.displayTitle || ''
  characterForm.rolePosition = character.rolePosition || ''
  characterForm.storyRole = character.storyRole || ''
  characterForm.description = character.description || ''
  characterForm.traits = character.traits || ''
  characterForm.relationships = character.relationships || ''
  showCharacterDialog.value = true
}

const showCharacterDetail = ref(false)
const detailCharacter = ref<CharacterItem | null>(null)

function openCharacterDetail(character: CharacterItem) {
  detailCharacter.value = character
  showCharacterDetail.value = true
}

function editDetailCharacter() {
  if (!detailCharacter.value) return
  openEditCharacterDialog(detailCharacter.value)
  showCharacterDetail.value = false
}

async function refreshDetailCharacter() {
  const currentId = detailCharacter.value?.id
  await refreshCharacters()
  if (!currentId) return
  detailCharacter.value =
    characters.value?.find((character) => character.id === currentId) ?? null
}

function getFirstFormErrorMessage(error: unknown) {
  if (Array.isArray(error)) {
    const firstError = error.flat().find((item) => item?.message)
    return firstError?.message ?? '角色表单校验未通过'
  }
  return '角色表单校验未通过'
}

function getCharacterPayload() {
  return {
    name: characterForm.name?.trim() || '',
    realName: characterForm.realName?.trim() || undefined,
    displayTitle: characterForm.displayTitle?.trim() || undefined,
    rolePosition: characterForm.rolePosition?.trim() || undefined,
    storyRole: characterForm.storyRole?.trim() || undefined,
    description: characterForm.description?.trim() || undefined,
    traits: characterForm.traits?.trim() || undefined,
    relationships: characterForm.relationships?.trim() || undefined
  }
}

async function saveCharacter() {
  try {
    await characterFormRef.value?.validate()
  } catch (error) {
    message.error(getFirstFormErrorMessage(error))
    return
  }

  savingCharacter.value = true
  try {
    const payload = getCharacterPayload()
    if (editingCharacterId.value) {
      await put(
        `/api/novels/${novelId.value}/characters/${editingCharacterId.value}`,
        payload,
        { successMessage: '角色已更新' }
      )
    } else {
      await post(`/api/novels/${novelId.value}/characters`, payload, {
        successMessage: '角色已创建'
      })
    }
    showCharacterDialog.value = false
    await refreshCharacters()
  } catch {
    // useApi handles error display
  } finally {
    savingCharacter.value = false
  }
}

async function enrichCharacter() {
  if (!editingCharacterId.value) return
  if (!characterForm.name?.trim()) {
    message.warning('请先输入角色名')
    return
  }

  const hasEmptyFields =
    !characterForm.realName?.trim() ||
    !characterForm.displayTitle?.trim() ||
    !characterForm.rolePosition?.trim() ||
    !characterForm.storyRole?.trim() ||
    !characterForm.description?.trim() ||
    !characterForm.traits?.trim() ||
    !characterForm.relationships?.trim()

  if (!hasEmptyFields) {
    message.info('所有字段已填写，无需 AI 丰富')
    return
  }

  enrichingCharacter.value = true
  try {
    const result = await post<{ enriched: Record<string, string> }>(
      `/api/novels/${novelId.value}/characters/${editingCharacterId.value}/enrich`,
      {
        name: characterForm.name,
        realName: characterForm.realName,
        displayTitle: characterForm.displayTitle,
        rolePosition: characterForm.rolePosition,
        storyRole: characterForm.storyRole,
        description: characterForm.description,
        traits: characterForm.traits,
        relationships: characterForm.relationships
      }
    )

    if (result.enriched.realName && !characterForm.realName?.trim()) {
      characterForm.realName = result.enriched.realName
    }
    if (result.enriched.displayTitle && !characterForm.displayTitle?.trim()) {
      characterForm.displayTitle = result.enriched.displayTitle
    }
    if (result.enriched.rolePosition && !characterForm.rolePosition?.trim()) {
      characterForm.rolePosition = result.enriched.rolePosition
    }
    if (result.enriched.storyRole && !characterForm.storyRole?.trim()) {
      characterForm.storyRole = result.enriched.storyRole
    }
    if (result.enriched.description && !characterForm.description?.trim()) {
      characterForm.description = result.enriched.description
    }
    if (result.enriched.traits && !characterForm.traits?.trim()) {
      characterForm.traits = result.enriched.traits
    }
    if (result.enriched.relationships && !characterForm.relationships?.trim()) {
      characterForm.relationships = result.enriched.relationships
    }

    message.success('AI 已填充空白字段，请检查后保存')
  } catch {
  } finally {
    enrichingCharacter.value = false
  }
}

async function deleteCharacter(character: CharacterItem) {
  const confirmed = await confirmDelete(character.name)
  if (!confirmed) return
  try {
    await apiDel(`/api/novels/${novelId.value}/characters/${character.id}`, {
      successMessage: '角色已删除',
      silent: true
    })
    await refreshCharacters()
  } catch (e: any) {
    if (e?.statusCode === 409 || e?.data?.statusCode === 409) {
      message.warning(e?.data?.message || '该角色有出场记录，无法删除')
    } else {
      message.error('角色删除失败')
    }
  }
}

function getRoleLabel(role: CharacterAppearanceItem['role']) {
  if (role === 'main') return '主角'
  if (role === 'mentioned') return '提及'
  return '配角'
}

// AI Character Generation
const showGenerateDialog = ref(false)
const generateCount = ref(3)
const generatePromptId = ref<number>(0)
const generating = ref(false)
const characterStreamText = ref('')
const characterGenerateError = ref('')

const showExportDialog = ref(false)
const exportFormat = ref<'txt' | 'md' | 'epub'>('md')
const exporting = ref(false)

async function exportNovel() {
  exporting.value = true
  try {
    const response = await $fetch<Blob>(`/api/novels/${novelId.value}/export`, {
      method: 'GET',
      params: { format: exportFormat.value },
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(response)
    const link = document.createElement('a')
    link.href = url
    const ext = exportFormat.value
    const filename = `${novel.value?.title || 'novel'}.${ext}`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success(`已导出 ${filename}`)
    showExportDialog.value = false
  } catch (e: any) {
    message.error(e?.data?.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

const { data: characterPrompts } = await useFetch<
  Array<{ id: number; name: string; content: string }>
>('/api/prompts/character-generation', { default: () => [] })

const promptOptions = computed(() => [
  { label: '内置角色生成规则', value: 0 },
  ...(characterPrompts.value || []).map((p) => ({
    label: `自定义：${p.name}`,
    value: p.id
  }))
])

function openGenerateDialog() {
  generateCount.value = 3
  generatePromptId.value = 0
  characterStreamText.value = ''
  characterGenerateError.value = ''
  showGenerateDialog.value = true
}

async function generateCharacters() {
  if (generating.value) return
  generating.value = true
  characterStreamText.value = ''
  characterGenerateError.value = ''
  try {
    await startStream({
      url: `/api/novels/${novelId.value}/characters/generate`,
      body: {
        count: generateCount.value,
        promptTemplateId: generatePromptId.value || undefined
      },
      onChunk: (chunk) => {
        characterStreamText.value += chunk
      },
      onDone: async (_fullContent, parsedJson) => {
        try {
          const parsed = parsedJson
          if (!Array.isArray(parsed) || !parsed.length) {
            characterGenerateError.value =
              'AI 未返回可用角色，请换一个模型或减少生成数量后重试。'
            message.warning(characterGenerateError.value)
            return
          }
          const result = await post<{ created: number }>(
            `/api/novels/${novelId.value}/characters-batch`,
            { characters: parsed }
          )
          if (!result.created) {
            characterGenerateError.value =
              'AI 返回的角色与现有角色重名，没有新增角色。'
            message.warning(characterGenerateError.value)
            return
          }
          message.success(`成功生成 ${result.created} 个角色`)
          showGenerateDialog.value = false
          await refreshCharacters()
        } catch (error: any) {
          characterGenerateError.value =
            error?.data?.message ||
            error?.message ||
            'AI 返回格式异常，未能保存角色。'
          message.warning(characterGenerateError.value)
        }
      },
      onError: (err, partialContent) => {
        characterGenerateError.value = err
        if (partialContent) characterStreamText.value = partialContent
        message.error(err)
      }
    })
  } catch (error: any) {
    if (!characterGenerateError.value) {
      characterGenerateError.value =
        error?.data?.message || error?.message || '角色生成失败，请稍后重试。'
      message.error(characterGenerateError.value)
    }
  } finally {
    generating.value = false
  }
}

const { data: plotPoints, refresh: refreshPlotPoints } = await useFetch<
  PlotPointItem[]
>(`/api/novels/${novelId.value}/plot-points`, {
  immediate: !!novel.value,
  default: () => []
})

const showPlotPointDialog = ref(false)
const addingPlotPoint = ref(false)
const plotPointForm = reactive({
  description: '',
  type: 'setup' as PlotPointItem['type'],
  status: 'introduced' as PlotPointItem['status'],
  chapterId: null as number | null
})

const plotPointTypeOptions = [
  { label: '铺垫', value: 'setup' },
  { label: '冲突', value: 'conflict' },
  { label: '收束', value: 'resolution' },
  { label: '转折', value: 'twist' }
]

const plotPointStatusOptions = [
  { label: '引入', value: 'introduced' },
  { label: '发展中', value: 'developing' },
  { label: '已解决', value: 'resolved' }
]

function getPlotPointTypeLabel(type: string) {
  const map: Record<string, string> = {
    setup: '铺垫',
    conflict: '冲突',
    resolution: '收束',
    twist: '转折'
  }
  return map[type] || type
}

function getPlotPointStatusType(status: string) {
  if (status === 'resolved') return 'success'
  if (status === 'developing') return 'warning'
  return 'default'
}

function openPlotPointDialog() {
  plotPointForm.description = ''
  plotPointForm.type = 'setup'
  plotPointForm.status = 'introduced'
  plotPointForm.chapterId = null
  showPlotPointDialog.value = true
}

async function savePlotPoint() {
  const description = plotPointForm.description.trim()
  if (!description) {
    message.warning('请输入情节描述')
    return
  }
  addingPlotPoint.value = true
  try {
    await post(
      `/api/novels/${novelId.value}/plot-points`,
      {
        description,
        type: plotPointForm.type,
        status: plotPointForm.status,
        chapterId: plotPointForm.chapterId || undefined
      },
      { successMessage: '情节线索已添加' }
    )
    showPlotPointDialog.value = false
    await refreshPlotPoints()
  } catch {
    // useApi handles error display
  } finally {
    addingPlotPoint.value = false
  }
}
</script>

<template>
  <div class="w-full">
    <div
      v-if="novel"
      class="space-y-4"
    >
      <section class="card-glass overflow-hidden p-0">
        <div class="grid xl:grid-cols-[minmax(0,1fr)_380px]">
          <div class="min-w-0 p-5 lg:p-6">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-block h-5 w-1 rounded-full"
                :style="{ backgroundColor: genreColor(novel.genre) }"
              />
              <NTag
                size="small"
                :type="statusColor"
                >{{ statusLabel }}</NTag
              >
              <span class="text-xs text-(--ui-text-dimmed)">{{
                novel.genre || '未分类'
              }}</span>
              <span class="text-xs text-(--ui-text-dimmed)">
                创建于 {{ formatDate(novel.createdAt) }}
              </span>
            </div>

            <div class="mt-4 max-w-4xl">
              <h1
                class="text-2xl font-semibold tracking-tight text-(--ui-text-highlighted) lg:text-4xl"
              >
                {{ novel.title }}
              </h1>
              <p
                class="mt-3 max-w-3xl text-sm leading-relaxed text-(--ui-text-muted)"
              >
                {{ novel.description || '暂无简介' }}
              </p>
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
              <NButton
                size="small"
                type="primary"
                @click="
                  latestChapter ?
                    navigateTo(
                      `/novels/${novel.id}/chapters/${latestChapter.id}`
                    )
                  : openNewChapterDialog()
                "
              >
                <template #icon><Icon icon="lucide:pen-tool" /></template>
                继续写作
              </NButton>
              <NButton
                secondary
                size="small"
                @click="navigateTo(`/novels/${novel.id}/read`)"
              >
                <template #icon><Icon icon="lucide:book-open" /></template>
                阅读全文
              </NButton>
              <NButton
                secondary
                size="small"
                @click="showExportDialog = true"
              >
                <template #icon><Icon icon="lucide:download" /></template>
                导出
              </NButton>
              <NButton
                quaternary
                size="small"
                type="error"
                @click="deleteNovel"
              >
                <template #icon><Icon icon="lucide:trash-2" /></template>
              </NButton>
            </div>

            <dl
              class="mt-6 grid gap-3 rounded-xl bg-(--ui-bg-muted)/70 px-3 py-3 ring-1 ring-(--ui-border) sm:grid-cols-2 lg:grid-cols-6"
            >
              <div>
                <dt class="text-[11px] text-(--ui-text-dimmed)">章节</dt>
                <dd
                  class="mt-0.5 font-mono text-base text-(--ui-text-highlighted)"
                >
                  {{ chapters?.length || 0 }}
                </dd>
              </div>
              <div>
                <dt class="text-[11px] text-(--ui-text-dimmed)">字数</dt>
                <dd
                  class="mt-0.5 font-mono text-base text-(--ui-text-highlighted)"
                >
                  {{ totalWords.toLocaleString() }}
                </dd>
              </div>
              <div>
                <dt class="text-[11px] text-(--ui-text-dimmed)">角色</dt>
                <dd
                  class="mt-0.5 font-mono text-base text-(--ui-text-highlighted)"
                >
                  {{ sortedCharacters.length }}
                </dd>
              </div>
              <div>
                <dt class="text-[11px] text-(--ui-text-dimmed)">出场</dt>
                <dd
                  class="mt-0.5 font-mono text-base text-(--ui-text-highlighted)"
                >
                  {{ characterChapterCount }}
                </dd>
              </div>
              <div>
                <dt class="text-[11px] text-(--ui-text-dimmed)">状态</dt>
                <dd
                  class="mt-0.5 truncate text-sm text-(--ui-text-highlighted)"
                >
                  {{ statusLabel }}
                </dd>
              </div>
              <div>
                <dt class="text-[11px] text-(--ui-text-dimmed)">更新</dt>
                <dd
                  class="mt-0.5 truncate text-sm text-(--ui-text-highlighted)"
                >
                  {{ formatDate(novel.updatedAt) }}
                </dd>
              </div>
            </dl>
          </div>

          <aside
            class="border-t border-(--ui-border) bg-(--ui-bg-muted)/60 p-5 xl:border-l xl:border-t-0 lg:p-6"
          >
            <div class="flex items-center gap-2">
              <Icon
                icon="lucide:compass"
                class="size-4 text-primary-500"
              />
              <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
                下一步写作
              </h2>
            </div>

            <div class="mt-4 rounded-xl bg-(--ui-bg-elevated)/70 p-3">
              <p class="text-[11px] text-(--ui-text-dimmed)">最近章节</p>
              <p class="mt-1 truncate text-sm text-(--ui-text-highlighted)">
                <template v-if="latestChapter">
                  Ch.{{ latestChapter.chapterNumber }}
                  {{
                    stripChapterNumberPrefix(latestChapter.title) || '未命名'
                  }}
                </template>
                <template v-else>还没有章节</template>
              </p>
              <p
                v-if="latestChapter?.summary"
                class="mt-2 line-clamp-2 text-xs leading-relaxed text-(--ui-text-muted)"
              >
                {{ latestChapter.summary }}
              </p>
            </div>

            <div class="mt-3 rounded-xl bg-(--ui-bg-elevated)/70 p-3">
              <p class="text-[11px] text-(--ui-text-dimmed)">下一条大纲</p>
              <p class="mt-1 text-sm text-(--ui-text-highlighted)">
                <template v-if="nextOutline">
                  Ch.{{ nextOutline.chapterNumber }}
                </template>
                <template v-else>暂无大纲</template>
              </p>
              <p
                class="mt-2 line-clamp-3 text-xs leading-relaxed text-(--ui-text-muted)"
              >
                {{
                  nextOutline?.description ||
                  '可以先生成章节大纲，再开始正文创作。'
                }}
              </p>
            </div>

            <button
              class="mt-3 flex w-full items-center gap-2 rounded-xl bg-(--ui-bg-elevated)/70 p-3 text-left ring-1 ring-transparent transition-colors hover:ring-(--ui-border-active)"
              type="button"
              @click="openAiSettings"
            >
              <Icon
                icon="lucide:sparkles"
                class="size-4 shrink-0 text-primary-500"
              />
              <span class="min-w-0 flex-1">
                <span class="block text-xs text-(--ui-text-dimmed)"
                  >AI 设定</span
                >
                <span
                  class="mt-0.5 block truncate text-sm text-(--ui-text-highlighted)"
                >
                  {{ novel.aiConfigName || '未设置模型' }} ·
                  {{ novel.aiTemperature || '默认温度' }}
                </span>
              </span>
              <Icon
                icon="lucide:pencil"
                class="size-3.5 text-(--ui-text-dimmed)"
              />
            </button>

            <div class="mt-4 grid gap-2">
              <div
                v-for="item in writingPlanItems"
                :key="item.label"
                class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5"
              >
                <Icon
                  :icon="item.icon"
                  class="size-3.5"
                  :class="item.tone"
                />
                <p class="truncate text-xs text-(--ui-text-muted)">
                  {{ item.description }}
                </p>
                <span class="font-mono text-xs text-(--ui-text-highlighted)">
                  {{ item.value }}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <!-- Novel Setup Guide -->
      <section
        v-if="showSetupGuide"
        class="card-glass overflow-hidden p-5"
      >
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon
              icon="lucide:sparkles"
              class="size-5 text-amber-500"
            />
            <h2 class="font-semibold text-(--ui-text-highlighted)">
              快速设定引导
            </h2>
          </div>
          <NButton
            size="tiny"
            quaternary
            @click="dismissSetupGuide"
          >
            <template #icon><Icon icon="lucide:x" /></template>
            跳过
          </NButton>
        </div>
        <p class="mb-4 text-sm text-(--ui-text-muted)">
          完成以下步骤可以帮助 AI
          更好地理解你的故事，生成更连贯的内容。每步都可跳过，随时回来补充。
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div
            class="rounded-xl p-4 ring-1 transition-colors"
            :class="
              setupStep1Done ?
                'bg-green-500/5 ring-green-500/30'
              : 'bg-(--ui-bg-muted) ring-(--ui-border) hover:ring-(--ui-border-active)'
            "
          >
            <div class="mb-2 flex items-center gap-2">
              <div
                class="flex size-6 items-center justify-center rounded-full text-xs font-bold"
                :class="
                  setupStep1Done ?
                    'bg-green-500/20 text-green-600'
                  : 'bg-primary-500/20 text-primary-500'
                "
              >
                {{ setupStep1Done ? '✓' : '1' }}
              </div>
              <span class="text-sm font-medium text-(--ui-text-highlighted)"
                >世界观设定</span
              >
            </div>
            <p class="mb-3 text-xs text-(--ui-text-muted)">
              描述故事发生的世界背景，AI 可辅助扩展。
            </p>
            <NButton
              v-if="!setupStep1Done"
              size="tiny"
              type="primary"
              @click="openAiSettings"
            >
              去设定
            </NButton>
            <span
              v-else
              class="text-xs text-green-600"
              >已完成</span
            >
          </div>

          <div
            class="rounded-xl p-4 ring-1 transition-colors"
            :class="
              setupStep2Done ?
                'bg-green-500/5 ring-green-500/30'
              : 'bg-(--ui-bg-muted) ring-(--ui-border) hover:ring-(--ui-border-active)'
            "
          >
            <div class="mb-2 flex items-center gap-2">
              <div
                class="flex size-6 items-center justify-center rounded-full text-xs font-bold"
                :class="
                  setupStep2Done ?
                    'bg-green-500/20 text-green-600'
                  : 'bg-primary-500/20 text-primary-500'
                "
              >
                {{ setupStep2Done ? '✓' : '2' }}
              </div>
              <span class="text-sm font-medium text-(--ui-text-highlighted)"
                >创建角色</span
              >
            </div>
            <p class="mb-3 text-xs text-(--ui-text-muted)">
              添加主要角色，AI 可根据世界观建议角色。
            </p>
            <NButton
              v-if="!setupStep2Done"
              size="tiny"
              type="primary"
              @click="showCharacterDialog = true"
            >
              添加角色
            </NButton>
            <span
              v-else
              class="text-xs text-green-600"
              >已完成</span
            >
          </div>

          <div
            class="rounded-xl p-4 ring-1 transition-colors"
            :class="
              setupStep3Done ?
                'bg-green-500/5 ring-green-500/30'
              : 'bg-(--ui-bg-muted) ring-(--ui-border) hover:ring-(--ui-border-active)'
            "
          >
            <div class="mb-2 flex items-center gap-2">
              <div
                class="flex size-6 items-center justify-center rounded-full text-xs font-bold"
                :class="
                  setupStep3Done ?
                    'bg-green-500/20 text-green-600'
                  : 'bg-primary-500/20 text-primary-500'
                "
              >
                {{ setupStep3Done ? '✓' : '3' }}
              </div>
              <span class="text-sm font-medium text-(--ui-text-highlighted)"
                >规划大纲</span
              >
            </div>
            <p class="mb-3 text-xs text-(--ui-text-muted)">
              手动梳理章节大纲，为单章工作流程提供方向。
            </p>
            <NButton
              v-if="!setupStep3Done"
              size="tiny"
              type="primary"
              @click="startEditOutlines"
            >
              编辑大纲
            </NButton>
            <span
              v-else
              class="text-xs text-green-600"
              >已完成</span
            >
          </div>
        </div>
      </section>

      <div
        class="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.72fr)]"
      >
        <!-- Outline -->
        <section class="card-glass p-5">
          <div
            class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <Icon
                  icon="lucide:list-tree"
                  class="size-4 text-primary-500"
                />
                <h2 class="font-semibold text-(--ui-text-highlighted)">
                  章节大纲
                </h2>
              </div>
              <p class="mt-1 text-xs text-(--ui-text-dimmed)">
                {{ sortedOutlines.length }} 条大纲，可用于后续章节生成
              </p>
            </div>
            <div class="flex gap-2">
              <NButton
                v-if="!editingOutlines"
                size="tiny"
                type="primary"
                @click="startEditOutlines"
              >
                <template #icon><Icon icon="lucide:pencil" /></template>
                编辑大纲
              </NButton>
              <template v-else>
                <NButton
                  size="tiny"
                  quaternary
                  @click="cancelEditOutlines"
                >
                  取消
                </NButton>
                <NButton
                  size="tiny"
                  type="primary"
                  :loading="savingOutlines"
                  @click="saveOutlines"
                >
                  保存
                </NButton>
              </template>
            </div>
          </div>

          <div
            v-if="!editingOutlines && sortedOutlines.length"
            class="mb-3"
          >
            <NInput
              v-model:value="outlineSearchQuery"
              clearable
              size="small"
              placeholder="搜索章节号或大纲内容"
            >
              <template #prefix>
                <Icon
                  icon="lucide:search"
                  class="size-4 text-(--ui-text-dimmed)"
                />
              </template>
            </NInput>
          </div>

          <div
            v-if="editingOutlines"
            class="max-h-[420px] space-y-2 overflow-y-auto pr-1"
          >
            <div
              v-for="(outline, index) in outlineFormItems"
              :key="index"
              draggable="true"
              class="grid gap-2 rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-2 md:grid-cols-[auto_120px_minmax(0,1fr)_auto] cursor-move transition-opacity"
              :class="{ 'opacity-50': draggingOutlineIndex === index }"
              @dragstart="handleOutlineDragStart(index)"
              @dragover="handleOutlineDragOver($event, index)"
              @dragend="handleOutlineDragEnd"
            >
              <div class="flex items-center text-(--ui-text-dimmed)">
                <Icon
                  icon="lucide:grip-vertical"
                  class="size-4"
                />
              </div>
              <NInputNumber
                v-model:value="outline.chapterNumber"
                :min="1"
                size="small"
                class="w-full"
              />
              <NInput
                v-model:value="outline.description"
                size="small"
                placeholder="本章核心事件、冲突或转折"
              />
              <NButton
                size="small"
                quaternary
                type="error"
                @click="removeOutlineItem(index)"
              >
                删除
              </NButton>
            </div>
            <NButton
              size="small"
              dashed
              block
              @click="addOutlineItem"
            >
              <template #icon><Icon icon="lucide:plus" /></template>
              添加章节大纲
            </NButton>
          </div>

          <div
            v-else-if="!sortedOutlines.length"
            class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) py-8 text-center text-sm text-(--ui-text-muted)"
          >
            暂无章节大纲，可手动编辑后在章节工作流程中生成并验收单章计划。
          </div>

          <div
            v-else-if="!filteredOutlines.length"
            class="py-8 text-center"
          >
            <Icon
              icon="lucide:search-x"
              class="mx-auto size-8 text-(--ui-text-dimmed)"
            />
            <p class="mt-2 text-sm text-(--ui-text-muted)">没有匹配的大纲</p>
          </div>

          <div
            v-else
            class="grid max-h-[420px] gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3"
          >
            <article
              v-for="outline in filteredOutlines"
              :key="`${outline.chapterNumber}-${outline.sortOrder}`"
              class="cv-auto rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3"
            >
              <p class="text-xs font-mono text-primary-500">
                Ch.{{ outline.chapterNumber }}
              </p>
              <p
                class="mt-1 line-clamp-3 text-xs leading-relaxed text-(--ui-text-muted)"
              >
                {{ outline.description }}
              </p>
            </article>
          </div>
        </section>

        <aside class="space-y-4">
          <section class="card-glass p-5">
            <div class="mb-4 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <Icon
                    icon="lucide:scroll-text"
                    class="size-4 text-blue-500"
                  />
                  <h2 class="font-semibold text-(--ui-text-highlighted)">
                    创作约束
                  </h2>
                </div>
                <p class="mt-1 text-xs text-(--ui-text-dimmed)">
                  世界观、风格和模型会影响后续生成
                </p>
              </div>
              <NButton
                size="tiny"
                quaternary
                @click="openAiSettings"
              >
                <template #icon><Icon icon="lucide:pencil" /></template>
                编辑
              </NButton>
            </div>

            <div class="space-y-3">
              <section class="rounded-xl bg-(--ui-bg-muted) p-3">
                <div class="mb-1.5 flex items-center gap-2">
                  <Icon
                    icon="lucide:globe"
                    class="size-3.5 text-blue-500"
                  />
                  <h3 class="text-sm font-medium text-(--ui-text-highlighted)">
                    世界观
                  </h3>
                </div>
                <p
                  class="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-(--ui-text-muted)"
                >
                  {{ novel.worldSetting || '暂无世界观设定' }}
                </p>
              </section>

              <section class="rounded-xl bg-(--ui-bg-muted) p-3">
                <div class="mb-1.5 flex items-center gap-2">
                  <Icon
                    icon="lucide:palette"
                    class="size-3.5 text-amber-500"
                  />
                  <h3 class="text-sm font-medium text-(--ui-text-highlighted)">
                    风格指南
                  </h3>
                </div>
                <p
                  class="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-(--ui-text-muted)"
                >
                  {{ novel.styleGuide || '暂无风格指南' }}
                </p>
              </section>

              <section class="rounded-xl bg-(--ui-bg-muted) p-3">
                <div class="mb-1.5 flex items-center gap-2">
                  <Icon
                    icon="lucide:sparkles"
                    class="size-3.5 text-primary-500"
                  />
                  <h3 class="text-sm font-medium text-(--ui-text-highlighted)">
                    AI 设定
                  </h3>
                </div>
                <div
                  class="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
                >
                  <div class="rounded-md bg-(--ui-bg-elevated)/70 p-2">
                    <p class="text-(--ui-text-dimmed)">模型</p>
                    <p class="mt-1 truncate text-(--ui-text-highlighted)">
                      {{ novel.aiConfigName || '未设置' }}
                    </p>
                  </div>
                  <div class="rounded-md bg-(--ui-bg-elevated)/70 p-2">
                    <p class="text-(--ui-text-dimmed)">Temperature</p>
                    <p class="mt-1 font-mono text-(--ui-text-highlighted)">
                      {{ novel.aiTemperature || '默认' }}
                    </p>
                  </div>
                </div>
                <p
                  v-if="novel.aiExtraPrompt"
                  class="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-(--ui-text-muted)"
                >
                  {{ novel.aiExtraPrompt }}
                </p>
              </section>
            </div>
          </section>
        </aside>
      </div>

      <div
        class="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(420px,0.62fr)]"
      >
        <!-- Plot Points -->
        <section class="card-glass p-5">
          <div
            class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <Icon
                  icon="lucide:route"
                  class="size-4 text-violet-500"
                />
                <h2 class="font-semibold text-(--ui-text-highlighted)">
                  情节线索
                </h2>
              </div>
              <p class="mt-1 text-xs text-(--ui-text-dimmed)">
                {{ plotPoints?.length || 0 }} 个情节节点
              </p>
            </div>
            <NButton
              size="tiny"
              type="primary"
              @click="openPlotPointDialog"
            >
              <template #icon><Icon icon="lucide:plus" /></template>
              添加线索
            </NButton>
          </div>

          <div
            v-if="plotPoints?.length"
            class="mb-3"
          >
            <NInput
              v-model:value="plotPointSearchQuery"
              clearable
              size="small"
              placeholder="搜索情节描述、类型或关联章节"
            >
              <template #prefix>
                <Icon
                  icon="lucide:search"
                  class="size-4 text-(--ui-text-dimmed)"
                />
              </template>
            </NInput>
          </div>

          <div
            v-if="!plotPoints?.length"
            class="rounded-lg bg-(--ui-bg-muted)/30 py-8 text-center text-sm text-(--ui-text-muted)"
          >
            暂无情节点，可手动添加以追踪故事中的关键事件。
          </div>

          <div
            v-else-if="!filteredPlotPoints.length"
            class="py-8 text-center"
          >
            <Icon
              icon="lucide:search-x"
              class="mx-auto size-8 text-(--ui-text-dimmed)"
            />
            <p class="mt-2 text-sm text-(--ui-text-muted)">
              没有匹配的情节线索
            </p>
          </div>

          <div
            v-else
            class="max-h-[420px] space-y-2 overflow-y-auto pr-1"
          >
            <div
              v-for="point in filteredPlotPoints"
              :key="point.id"
              class="flex items-start gap-3 rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3"
            >
              <div
                class="mt-0.5 size-2 shrink-0 rounded-full"
                :class="{
                  'bg-emerald-500': point.status === 'resolved',
                  'bg-amber-500': point.status === 'developing',
                  'bg-(--ui-text-dimmed)': point.status === 'introduced'
                }"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <NTag
                    size="tiny"
                    :type="getPlotPointStatusType(point.status)"
                  >
                    {{ getPlotPointTypeLabel(point.type) }}
                  </NTag>
                  <span
                    v-if="point.chapterId"
                    class="text-[11px] text-(--ui-text-dimmed)"
                  >
                    关联章节
                    {{
                      chapters?.find((c) => c.id === point.chapterId)
                        ?.chapterNumber || point.chapterId
                    }}
                  </span>
                </div>
                <p class="mt-1 text-xs leading-relaxed text-(--ui-text-muted)">
                  {{ point.description }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="card-glass p-5">
          <NovelForeshadowingPanel
            :novel-id="novelId"
            :chapters="chapters || []"
            :refresh-key="foreshadowingRefreshKey"
          />
        </section>
      </div>

      <div class="stagger-children grid gap-4">
        <!-- Chapters -->
        <section class="card-glass p-5">
          <div class="mb-4 flex flex-col gap-4">
            <div
              class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <Icon
                    icon="lucide:book-open"
                    class="size-4 text-primary-500"
                  />
                  <h2 class="font-semibold text-(--ui-text-highlighted)">
                    章节列表
                  </h2>
                </div>
                <p class="mt-1 text-xs text-(--ui-text-dimmed)">
                  {{ chapterFilterText }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <NButton
                  v-if="chapterReorderMode"
                  size="tiny"
                  type="success"
                  :loading="savingChapterOrder"
                  @click="saveChapterOrder"
                >
                  <template #icon><Icon icon="lucide:check" /></template>
                  保存排序
                </NButton>
                <NButton
                  v-if="chapterReorderMode"
                  size="tiny"
                  quaternary
                  @click="chapterReorderMode = false"
                >
                  取消
                </NButton>

                <template v-if="chapterSelectMode">
                  <NCheckbox
                    :checked="allChaptersSelected"
                    :indeterminate="
                      selectedChapterIds.length > 0 && !allChaptersSelected
                    "
                    @update:checked="toggleSelectAllChapters"
                  >
                    全选
                  </NCheckbox>
                  <span class="text-xs text-(--ui-text-dimmed)"
                    >已选 {{ selectedChapterIds.length }}</span
                  >
                  <NButton
                    size="tiny"
                    type="error"
                    :disabled="!selectedChapterIds.length"
                    @click="confirmBatchDeleteChapters"
                  >
                    <template #icon><Icon icon="lucide:trash-2" /></template>
                    批量删除
                  </NButton>
                  <NButton
                    size="tiny"
                    quaternary
                    @click="toggleChapterSelectMode"
                  >
                    退出
                  </NButton>
                </template>

                <template v-if="!chapterReorderMode && !chapterSelectMode">
                  <NButton
                    v-if="chapters && chapters.length > 1"
                    size="tiny"
                    quaternary
                    @click="chapterReorderMode = true"
                  >
                    <template #icon
                      ><Icon icon="lucide:arrow-up-down"
                    /></template>
                    排序
                  </NButton>
                  <NButton
                    v-if="chapters && chapters.length"
                    size="tiny"
                    quaternary
                    @click="toggleChapterSelectMode"
                  >
                    <template #icon
                      ><Icon icon="lucide:list-checks"
                    /></template>
                    批量
                  </NButton>
                  <NButton
                    size="tiny"
                    type="primary"
                    @click="openNewChapterDialog"
                  >
                    <template #icon><Icon icon="lucide:plus" /></template>
                    新建章节
                  </NButton>
                </template>
              </div>
            </div>

            <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <NInput
                v-model:value="chapterSearchQuery"
                clearable
                size="small"
                placeholder="搜索章节编号、标题、摘要或字数"
              >
                <template #prefix>
                  <Icon
                    icon="lucide:search"
                    class="size-4 text-(--ui-text-dimmed)"
                  />
                </template>
              </NInput>
              <NSelect
                v-model:value="chapterStatusFilter"
                size="small"
                :options="chapterStatusOptions"
              />
              <NButton
                size="small"
                quaternary
                :disabled="!chapterSearchQuery && chapterStatusFilter === 'all'"
                @click="clearChapterFilters"
              >
                <template #icon><Icon icon="lucide:rotate-ccw" /></template>
                重置
              </NButton>
            </div>
          </div>
          <div class="max-h-[520px] overflow-y-auto pr-1">
            <div
              v-if="!chapters?.length"
              class="py-10 text-center text-sm text-(--ui-text-muted)"
            >
              还没有章节，点击上方按钮开始写作
            </div>
            <div
              v-else-if="!filteredChapters.length"
              class="py-10 text-center"
            >
              <Icon
                icon="lucide:search-x"
                class="mx-auto size-8 text-(--ui-text-dimmed)"
              />
              <p class="mt-2 text-sm text-(--ui-text-muted)">没有匹配的章节</p>
              <NButton
                class="mt-3"
                size="tiny"
                quaternary
                @click="clearChapterFilters"
              >
                清空筛选
              </NButton>
            </div>
            <TransitionGroup
              v-else
              name="list"
              tag="div"
              class="relative space-y-2"
            >
              <template
                v-for="(chapter, index) in filteredChapters"
                :key="chapter.id"
              >
                <div
                  v-if="chapterReorderMode"
                  draggable="true"
                  class="group grid gap-3 rounded-lg p-3 transition-colors cursor-move ring-1 ring-(--ui-border) bg-(--ui-bg-muted) sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center"
                  :class="draggingChapterIndex === index ? 'opacity-50' : ''"
                  @dragstart="handleChapterDragStart(index)"
                  @dragover="handleChapterDragOver($event, index)"
                  @dragend="handleChapterDragEnd"
                >
                  <div class="flex items-center gap-2 shrink-0">
                    <Icon
                      icon="lucide:grip-vertical"
                      class="size-4 text-(--ui-text-dimmed)"
                    />
                    <div
                      class="flex size-9 items-center justify-center rounded-lg bg-primary-400/10 text-xs font-semibold font-mono text-primary-500"
                    >
                      {{ index + 1 }}
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p
                      class="min-w-0 truncate text-sm font-medium text-(--ui-text-highlighted)"
                    >
                      {{ stripChapterNumberPrefix(chapter.title) || '未命名' }}
                    </p>
                  </div>
                </div>
                <div
                  v-else-if="chapterSelectMode"
                  class="group grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded-lg p-3 ring-1 transition-colors"
                  :class="
                    selectedChapterIds.includes(chapter.id) ?
                      'bg-primary-500/5 ring-primary-500/40'
                    : 'ring-(--ui-border) bg-(--ui-bg-muted) hover:bg-(--ui-bg-elevated)/60'
                  "
                  @click="toggleChapterSelection(chapter.id)"
                >
                  <NCheckbox
                    :checked="selectedChapterIds.includes(chapter.id)"
                    @click.stop="toggleChapterSelection(chapter.id)"
                  />
                  <div
                    class="flex size-9 items-center justify-center rounded-lg bg-primary-400/10 text-xs font-semibold font-mono text-primary-500 shrink-0"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p
                      class="min-w-0 truncate text-sm font-medium text-(--ui-text-highlighted)"
                    >
                      {{ stripChapterNumberPrefix(chapter.title) || '未命名' }}
                    </p>
                    <div
                      class="mt-1 flex items-center gap-2 text-xs text-(--ui-text-dimmed)"
                    >
                      <span>{{ chapter.wordCount || 0 }} 字</span>
                    </div>
                  </div>
                </div>
                <NuxtLink
                  v-else
                  :to="`/novels/${novel.id}/chapters/${chapter.id}`"
                  class="cv-auto group grid gap-3 rounded-lg p-3 transition-colors hover:bg-(--ui-bg-elevated)/60 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <div
                    class="flex size-9 items-center justify-center rounded-lg bg-primary-400/10 text-xs font-semibold font-mono text-primary-500 shrink-0"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p
                        class="min-w-0 truncate text-sm font-medium text-(--ui-text-highlighted)"
                      >
                        {{
                          stripChapterNumberPrefix(chapter.title) || '未命名'
                        }}
                      </p>
                      <NTag
                        size="tiny"
                        :type="getChapterStatusType(chapter.status)"
                      >
                        {{ getChapterStatusLabel(chapter.status) }}
                      </NTag>
                    </div>
                    <p
                      v-if="chapter.summary"
                      class="mt-1 line-clamp-2 text-xs leading-relaxed text-(--ui-text-muted)"
                    >
                      {{ chapter.summary }}
                    </p>
                    <div
                      class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-(--ui-text-dimmed)"
                    >
                      <span>{{ chapter.wordCount || 0 }} 字</span>
                      <span>{{ formatDate(chapter.updatedAt) }}</span>
                    </div>
                  </div>
                  <div
                    class="hidden items-center gap-1 text-xs text-(--ui-text-dimmed) sm:flex"
                  >
                    写作
                    <Icon
                      icon="lucide:chevron-right"
                      class="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                </NuxtLink>
              </template>
            </TransitionGroup>
          </div>
        </section>

        <section
          class="card-glass flex flex-col overflow-hidden p-4 lg:p-5"
          style="max-height: 720px"
        >
          <div class="flex flex-col gap-3">
            <div
              class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <Icon
                    icon="lucide:users"
                    class="size-4 text-primary-500"
                  />
                  <h2 class="font-semibold text-(--ui-text-highlighted)">
                    角色档案
                  </h2>
                </div>
                <p class="mt-1 text-xs text-(--ui-text-dimmed)">
                  {{ characterFilterText }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="flex rounded-md bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-0.5 gap-0.5"
                >
                  <button
                    class="rounded-sm px-2 py-1 text-[11px] font-medium transition-colors"
                    :class="
                      characterViewMode === 'cards' ?
                        'bg-(--ui-bg-elevated) text-(--ui-text-highlighted) shadow-sm'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text)'
                    "
                    @click="characterViewMode = 'cards'"
                  >
                    卡片
                  </button>
                  <button
                    class="rounded-sm px-2 py-1 text-[11px] font-medium transition-colors"
                    :class="
                      characterViewMode === 'graph' ?
                        'bg-(--ui-bg-elevated) text-(--ui-text-highlighted) shadow-sm'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text)'
                    "
                    @click="characterViewMode = 'graph'"
                  >
                    关系图
                  </button>
                </div>
                <NButton
                  size="tiny"
                  @click="openGenerateDialog"
                >
                  <template #icon><Icon icon="lucide:sparkles" /></template>
                  AI 生成
                </NButton>
                <NButton
                  size="tiny"
                  type="primary"
                  @click="openCreateCharacterDialog"
                >
                  <template #icon><Icon icon="lucide:plus" /></template>
                  新增角色
                </NButton>
              </div>
            </div>

            <div
              v-show="characterViewMode === 'cards'"
              class="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_auto]"
            >
              <NInput
                v-model:value="characterSearchQuery"
                clearable
                size="small"
                placeholder="搜索角色、关系、状态或出场章节"
              >
                <template #prefix>
                  <Icon
                    icon="lucide:search"
                    class="size-4 text-(--ui-text-dimmed)"
                  />
                </template>
              </NInput>
              <NSelect
                v-model:value="characterAppearanceFilter"
                size="small"
                :options="characterAppearanceOptions"
              />
              <NButton
                size="small"
                quaternary
                :disabled="
                  !characterSearchQuery && characterAppearanceFilter === 'all'
                "
                @click="clearCharacterFilters"
              >
                <template #icon><Icon icon="lucide:rotate-ccw" /></template>
                重置
              </NButton>
            </div>
          </div>

          <div
            v-show="characterViewMode === 'cards'"
            class="flex-1 min-h-0 flex flex-col"
          >
            <div
              v-if="!sortedCharacters.length"
              class="flex flex-1 items-center justify-center py-10 text-center text-sm text-(--ui-text-muted)"
            >
              还没有角色，点击上方按钮创建角色档案
            </div>
            <div
              v-else-if="!filteredCharacters.length"
              class="flex flex-1 flex-col items-center justify-center py-10 text-center"
            >
              <Icon
                icon="lucide:search-x"
                class="size-8 text-(--ui-text-dimmed)"
              />
              <p class="mt-2 text-sm text-(--ui-text-muted)">没有匹配的角色</p>
              <NButton
                class="mt-3"
                size="tiny"
                quaternary
                @click="clearCharacterFilters"
              >
                清空筛选
              </NButton>
            </div>
            <div
              v-else
              class="mt-4 grid min-h-0 gap-3 overflow-y-auto pr-1 xl:grid-cols-2"
            >
              <article
                v-for="character in filteredCharacters"
                :key="character.id"
                class="cv-auto relative flex flex-col rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3 transition-all duration-200 hover:bg-(--ui-bg-muted) hover:-translate-y-0.5 hover:shadow-md hover:z-10"
              >
                <div class="flex items-start gap-2.5">
                  <div
                    class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-sm text-primary-600"
                  >
                    {{ getCharacterInitial(character) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <h3
                          class="truncate text-sm font-semibold text-(--ui-text-highlighted)"
                        >
                          {{ character.name || '未命名角色' }}
                        </h3>
                        <div class="mt-1 flex flex-wrap gap-1 text-[10px]">
                          <span
                            v-if="character.firstAppearanceChapter"
                            class="rounded bg-(--ui-bg-elevated) px-1.5 py-0.5 text-(--ui-text-muted)"
                          >
                            首次 Ch.{{ character.firstAppearanceChapter }}
                          </span>
                          <span
                            v-if="character.lastAppearanceChapter"
                            class="rounded bg-(--ui-bg-elevated) px-1.5 py-0.5 text-(--ui-text-muted)"
                          >
                            最近 Ch.{{ character.lastAppearanceChapter }}
                          </span>
                          <span
                            class="whitespace-nowrap rounded bg-(--ui-bg-elevated) px-1.5 py-0.5 text-(--ui-text-muted)"
                          >
                            {{ getCharacterAppearanceCount(character) }} 章出场
                          </span>
                        </div>
                      </div>
                      <div class="flex shrink-0 items-center gap-1">
                        <NTooltip>
                          <template #trigger>
                            <button
                              class="flex size-7 items-center justify-center rounded-md text-(--ui-text-dimmed) transition-colors hover:bg-(--ui-bg-elevated) hover:text-(--ui-text)"
                              @click="openCharacterDetail(character)"
                            >
                              <Icon
                                icon="lucide:eye"
                                class="size-3.5"
                              />
                            </button>
                          </template>
                          查看角色
                        </NTooltip>
                        <NTooltip>
                          <template #trigger>
                            <button
                              class="flex size-7 items-center justify-center rounded-md text-(--ui-text-dimmed) transition-colors hover:bg-(--ui-bg-elevated) hover:text-(--ui-text)"
                              @click="openEditCharacterDialog(character)"
                            >
                              <Icon
                                icon="lucide:pencil"
                                class="size-3.5"
                              />
                            </button>
                          </template>
                          编辑角色
                        </NTooltip>
                        <NTooltip>
                          <template #trigger>
                            <button
                              class="flex size-7 items-center justify-center rounded-md text-(--ui-text-dimmed) transition-colors hover:bg-red-500/10 hover:text-red-500"
                              @click="deleteCharacter(character)"
                            >
                              <Icon
                                icon="lucide:trash-2"
                                class="size-3.5"
                              />
                            </button>
                          </template>
                          删除角色
                        </NTooltip>
                      </div>
                    </div>
                  </div>
                </div>

                <p
                  v-if="character.description"
                  class="mt-2 line-clamp-2 text-xs leading-relaxed text-(--ui-text-muted)"
                >
                  {{ character.description }}
                </p>

                <div
                  v-if="
                    character.realName ||
                    character.displayTitle ||
                    character.rolePosition ||
                    character.storyRole
                  "
                  class="mt-3 grid gap-2 text-xs sm:grid-cols-2"
                >
                  <div
                    v-if="character.realName"
                    class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1.5"
                  >
                    <p class="text-[10px] text-(--ui-text-dimmed)">本名</p>
                    <p class="mt-0.5 leading-relaxed text-(--ui-text-muted)">
                      {{ character.realName }}
                    </p>
                  </div>
                  <div
                    v-if="character.displayTitle"
                    class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1.5"
                  >
                    <p class="text-[10px] text-(--ui-text-dimmed)">称呼/位分</p>
                    <p class="mt-0.5 leading-relaxed text-(--ui-text-muted)">
                      {{ character.displayTitle }}
                    </p>
                  </div>
                  <div
                    v-if="character.rolePosition"
                    class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1.5 sm:col-span-2"
                  >
                    <p class="text-[10px] text-(--ui-text-dimmed)">身份</p>
                    <p class="mt-0.5 leading-relaxed text-(--ui-text-muted)">
                      {{ character.rolePosition }}
                    </p>
                  </div>
                  <div
                    v-if="character.storyRole"
                    class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1.5 sm:col-span-2"
                  >
                    <p class="text-[10px] text-(--ui-text-dimmed)">作用</p>
                    <p class="mt-0.5 leading-relaxed text-(--ui-text-muted)">
                      {{ character.storyRole }}
                    </p>
                  </div>
                </div>

                <div
                  v-if="
                    character.traits ||
                    character.currentState ||
                    character.relationships
                  "
                  class="mt-3 grid gap-2 text-xs"
                >
                  <div
                    v-if="character.traits"
                    class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1.5"
                  >
                    <p class="text-[10px] text-(--ui-text-dimmed)">特征</p>
                    <p
                      class="mt-0.5 line-clamp-2 leading-relaxed text-(--ui-text-muted)"
                    >
                      {{ character.traits }}
                    </p>
                  </div>
                  <div class="grid gap-2">
                    <div
                      v-if="character.currentState"
                      class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1.5"
                    >
                      <p class="text-[10px] text-(--ui-text-dimmed)">状态</p>
                      <p
                        class="mt-0.5 line-clamp-2 leading-relaxed text-(--ui-text-muted)"
                      >
                        {{ character.currentState }}
                      </p>
                    </div>
                    <div
                      v-if="character.relationships"
                      class="rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1.5"
                    >
                      <p class="text-[10px] text-(--ui-text-dimmed)">关系</p>
                      <p
                        class="mt-0.5 line-clamp-2 leading-relaxed text-(--ui-text-muted)"
                      >
                        {{ character.relationships }}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  v-if="character.overallArc"
                  class="mt-3 rounded-md bg-primary-500/5 px-2 py-1.5 text-xs"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-[10px] font-medium text-primary-500/80">
                      故事弧线
                    </p>
                    <button
                      class="text-[10px] text-primary-600 transition-colors hover:text-primary-500"
                      type="button"
                      @click="openCharacterDetail(character)"
                    >
                      查看详情
                    </button>
                  </div>
                  <p
                    class="mt-0.5 line-clamp-2 leading-relaxed text-(--ui-text-muted)"
                  >
                    {{ character.overallArc }}
                  </p>
                </div>

                <div
                  v-if="character.appearances.length"
                  class="mt-auto border-t border-(--ui-border) pt-2.5"
                >
                  <div class="mb-1.5 flex items-center justify-between gap-2">
                    <p class="text-[10px] text-(--ui-text-dimmed)">最近出场</p>
                    <button
                      v-if="character.appearances.length > 2"
                      class="text-[10px] text-primary-600 transition-colors hover:text-primary-500"
                      @click="toggleCharacterAppearances(character.id)"
                    >
                      {{
                        isCharacterExpanded(character.id) ? '收起' : (
                          `展开 ${character.appearances.length - 2} 条`
                        )
                      }}
                    </button>
                  </div>
                  <div class="space-y-1.5">
                    <NuxtLink
                      v-for="appearance in character.appearances.slice(
                        0,
                        isCharacterExpanded(character.id) ? undefined : 2
                      )"
                      :key="`${appearance.chapterId}-${appearance.id}`"
                      :to="`/novels/${novel.id}/chapters/${appearance.chapterId}`"
                      class="block rounded-md bg-(--ui-bg-elevated)/65 px-2 py-1.5 transition-colors hover:bg-(--ui-bg-elevated)"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <p class="truncate text-xs text-(--ui-text)">
                          Ch.{{ appearance.chapterNumber }}
                          {{ appearance.chapterTitle }}
                        </p>
                        <span
                          class="shrink-0 rounded bg-(--ui-bg-muted) ring-1 ring-(--ui-border) px-1.5 py-0.5 text-[10px] text-(--ui-text-dimmed)"
                        >
                          {{ getRoleLabel(appearance.role) }}
                        </span>
                      </div>
                      <p
                        v-if="appearance.background || appearance.snippet"
                        class="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-(--ui-text-muted)"
                      >
                        {{ appearance.background || appearance.snippet }}
                      </p>
                    </NuxtLink>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <NovelCharacterRelationGraph
            v-show="characterViewMode === 'graph'"
            :characters="sortedCharacters"
            class="flex-1 min-h-0 mt-2"
          />

          <div class="mt-4 border-t border-(--ui-border) pt-4">
            <NovelCharacterSuggestions
              :novel-id="novelId"
              @adopted="refreshCharacters()"
            />
          </div>
        </section>
      </div>

      <NModal
        v-model:show="showNewChapterDialog"
        preset="card"
        title="新建章节"
        class="max-w-sm"
      >
        <div class="space-y-3">
          <NInput
            v-model:value="newChapterTitle"
            placeholder="章节标题（可留空，目录按顺序自动编号）"
            @keydown.enter="createNewChapter"
          />
          <div
            v-if="chapters && chapters.length"
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
            v-if="generatingChapterTitle || suggestedChapterTitle"
            class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-3 text-sm"
          >
            <div
              class="mb-2 flex items-center gap-2 text-xs text-(--ui-text-dimmed)"
            >
              <Icon
                icon="lucide:sparkles"
                class="h-3.5 w-3.5"
                :class="{ 'animate-spin': generatingChapterTitle }"
              />
              <span>{{
                generatingChapterTitle ? '正在生成章节名...' : 'AI 候选章节名'
              }}</span>
            </div>
            <div
              v-if="suggestedChapterTitle"
              class="rounded-md bg-(--ui-bg) px-3 py-2 font-medium text-(--ui-text-highlighted)"
            >
              {{ suggestedChapterTitle }}
            </div>
            <div
              v-if="titleSuggestionUsage"
              class="mt-2 text-[11px] text-(--ui-text-dimmed)"
            >
              {{ formatAiTitleUsage(titleSuggestionUsage) }}
            </div>
            <div
              v-if="suggestedChapterTitle"
              class="mt-3 flex justify-end gap-2"
            >
              <NButton
                size="tiny"
                quaternary
                :loading="generatingChapterTitle"
                @click="aiGenerateChapterTitle"
              >
                重新生成
              </NButton>
              <NButton
                size="tiny"
                type="primary"
                @click="applySuggestedChapterTitle"
              >
                采用
              </NButton>
            </div>
          </div>
          <NButton
            size="tiny"
            quaternary
            :loading="generatingChapterTitle"
            @click="aiGenerateChapterTitle"
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
            <NButton @click="showNewChapterDialog = false">取消</NButton>
            <NButton
              type="primary"
              :loading="creatingChapter"
              @click="createNewChapter"
            >
              创建
            </NButton>
          </div>
        </template>
      </NModal>

      <NModal
        v-model:show="showCharacterDialog"
        preset="card"
        :title="characterDialogTitle"
        class="max-w-lg"
      >
        <NForm
          ref="characterFormRef"
          :model="characterForm"
          label-placement="top"
        >
          <NFormItem
            label="角色名"
            path="name"
            :rule="{
              required: true,
              message: '请输入角色名',
              trigger: ['blur', 'input']
            }"
          >
            <NInput
              v-model:value="characterForm.name"
              placeholder="例如：李文"
            />
          </NFormItem>
          <NFormItem label="简介">
            <NInput
              v-model:value="characterForm.description"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="角色背景、身份或定位"
            />
          </NFormItem>
          <div class="grid gap-3 sm:grid-cols-2">
            <NFormItem label="本名">
              <NInput
                v-model:value="characterForm.realName"
                placeholder="未知时可填：本名待定"
              />
            </NFormItem>
            <NFormItem label="称呼/位分">
              <NInput
                v-model:value="characterForm.displayTitle"
                placeholder="例如：孙美人、张婕妤"
              />
            </NFormItem>
            <NFormItem label="身份定位">
              <NInput
                v-model:value="characterForm.rolePosition"
                placeholder="例如：皇后派中低阶妃嫔"
              />
            </NFormItem>
            <NFormItem label="剧情作用">
              <NInput
                v-model:value="characterForm.storyRole"
                placeholder="例如：负责引出皇后派试探"
              />
            </NFormItem>
          </div>
          <NFormItem label="性格特征">
            <NInput
              v-model:value="characterForm.traits"
              placeholder="例如：谨慎、敏锐、重情义"
            />
          </NFormItem>
          <NFormItem label="人物关系">
            <NInput
              v-model:value="characterForm.relationships"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="与其他角色的关系"
            />
          </NFormItem>
          <div
            v-if="
              editingCharacterData &&
              (editingCharacterData.currentState ||
                editingCharacterData.firstAppearanceChapter ||
                editingCharacterData.lastAppearanceChapter)
            "
            class="rounded-md bg-(--ui-bg-elevated) p-3 text-sm text-(--ui-text-muted)"
          >
            <div class="mb-1.5 text-xs font-medium">
              以下字段由系统根据章节内容自动维护
            </div>
            <div
              v-if="editingCharacterData.currentState"
              class="mb-1"
            >
              <span class="font-medium text-(--ui-text)">当前状态：</span
              >{{ editingCharacterData.currentState }}
            </div>
            <div
              v-if="editingCharacterData.firstAppearanceChapter"
              class="mb-1"
            >
              <span class="font-medium text-(--ui-text)">首次出现：</span>第
              {{ editingCharacterData.firstAppearanceChapter }} 章
            </div>
            <div v-if="editingCharacterData.lastAppearanceChapter">
              <span class="font-medium text-(--ui-text)">最近出现：</span>第
              {{ editingCharacterData.lastAppearanceChapter }} 章
            </div>
          </div>
        </NForm>
        <template #footer>
          <div class="flex justify-end gap-2">
            <NButton
              v-if="editingCharacterId"
              :loading="enrichingCharacter"
              :disabled="savingCharacter"
              @click="enrichCharacter"
            >
              <template #icon
                ><Icon
                  icon="lucide:sparkles"
                  class="size-3.5"
              /></template>
              AI 丰富
            </NButton>
            <NButton @click="showCharacterDialog = false">取消</NButton>
            <NButton
              type="primary"
              :loading="savingCharacter"
              @click="saveCharacter"
            >
              保存
            </NButton>
          </div>
        </template>
      </NModal>

      <!-- Workspace -->
      <section class="card-glass p-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon
              icon="lucide:workflow"
              class="size-4 text-primary-500"
            />
            <h2 class="font-semibold text-(--ui-text-highlighted)">AI 审核</h2>
          </div>
          <NButton
            size="small"
            type="primary"
            @click="navigateTo(`/novels/${novelId}/workspace`)"
          >
            <template #icon><Icon icon="lucide:external-link" /></template>
            打开审核
          </NButton>
        </div>
      </section>

      <!-- AI Generate Characters Dialog -->
      <NModal
        v-model:show="showGenerateDialog"
        preset="card"
        title="AI 生成角色"
        class="max-w-md"
        :mask-closable="!generating"
        :close-on-esc="!generating"
        :closable="!generating"
      >
        <NAlert
          v-if="characterGenerateError"
          type="error"
          class="mb-4"
          :show-icon="false"
        >
          {{ characterGenerateError }}
        </NAlert>
        <div class="space-y-4">
          <template v-if="generating">
            <NSpin size="small">
              <div class="text-sm text-(--ui-text-muted)">
                正在调用写作模型生成角色，完成后会自动保存到角色档案。
              </div>
            </NSpin>
            <div
              class="rounded-lg bg-(--ui-bg-elevated) p-3 max-h-64 overflow-y-auto"
            >
              <pre
                class="text-xs text-(--ui-text-muted) whitespace-pre-wrap font-sans leading-relaxed"
                >{{ characterStreamText || '正在生成角色...' }}</pre
              >
            </div>
          </template>
          <template v-else>
            <NForm>
              <NFormItem label="生成数量">
                <NInputNumber
                  v-model:value="generateCount"
                  :min="1"
                  :max="20"
                  class="w-full"
                />
              </NFormItem>
              <NFormItem label="生成规则">
                <NSelect
                  v-model:value="generatePromptId"
                  :options="promptOptions"
                  placeholder="选择生成规则"
                />
              </NFormItem>
            </NForm>
            <p class="text-xs text-(--ui-text-dimmed)">
              内置规则会根据小说简介、世界观、章节大纲和已有角色生成新角色；自定义规则来自后台「提示词模板」，用于替换内置角色设计要求。
            </p>
          </template>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <NButton
              :disabled="generating"
              @click="showGenerateDialog = false"
              >取消</NButton
            >
            <NButton
              type="primary"
              :loading="generating"
              :disabled="generating"
              @click="generateCharacters"
            >
              <template #icon><Icon icon="lucide:sparkles" /></template>
              开始生成
            </NButton>
          </div>
        </template>
      </NModal>

      <NModal
        v-model:show="showPlotPointDialog"
        preset="card"
        title="添加情节线索"
        style="max-width: 480px"
      >
        <div class="space-y-3">
          <NFormItem label="描述">
            <NInput
              v-model:value="plotPointForm.description"
              type="textarea"
              placeholder="发生了什么关键事件？"
              :rows="3"
            />
          </NFormItem>
          <div class="grid grid-cols-2 gap-3">
            <NFormItem label="类型">
              <NSelect
                v-model:value="plotPointForm.type"
                :options="plotPointTypeOptions"
              />
            </NFormItem>
            <NFormItem label="状态">
              <NSelect
                v-model:value="plotPointForm.status"
                :options="plotPointStatusOptions"
              />
            </NFormItem>
          </div>
          <NFormItem label="关联章节（可选）">
            <NSelect
              v-model:value="plotPointForm.chapterId"
              :options="
                (chapters || []).map((c) => ({
                  label: `Ch.${c.chapterNumber} ${c.title}`,
                  value: c.id
                }))
              "
              clearable
              placeholder="选择关联章节"
            />
          </NFormItem>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <NButton
              size="small"
              @click="showPlotPointDialog = false"
              >取消</NButton
            >
            <NButton
              type="primary"
              size="small"
              :loading="addingPlotPoint"
              :disabled="!plotPointForm.description.trim()"
              @click="savePlotPoint"
            >
              添加
            </NButton>
          </div>
        </template>
      </NModal>

      <!-- Export Dialog -->
      <NModal
        v-model:show="showExportDialog"
        preset="card"
        title="导出小说"
        style="max-width: 400px"
      >
        <div class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-(--ui-text)">导出格式</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                class="rounded-lg border px-3 py-3 text-center transition-colors"
                :class="
                  exportFormat === 'txt' ?
                    'border-primary-500 bg-primary-500/5 text-primary-600'
                  : 'border-(--ui-border)/40 text-(--ui-text-muted) hover:bg-(--ui-bg-elevated)'
                "
                @click="exportFormat = 'txt'"
              >
                <Icon
                  icon="lucide:file-text"
                  class="mx-auto mb-1 size-5"
                />
                <p class="text-xs">TXT</p>
              </button>
              <button
                class="rounded-lg border px-3 py-3 text-center transition-colors"
                :class="
                  exportFormat === 'md' ?
                    'border-primary-500 bg-primary-500/5 text-primary-600'
                  : 'border-(--ui-border) text-(--ui-text-muted) hover:bg-(--ui-bg-muted)'
                "
                @click="exportFormat = 'md'"
              >
                <Icon
                  icon="lucide:file-code"
                  class="mx-auto mb-1 size-5"
                />
                <p class="text-xs">Markdown</p>
              </button>
              <button
                class="rounded-lg border px-3 py-3 text-center transition-colors"
                :class="
                  exportFormat === 'epub' ?
                    'border-primary-500 bg-primary-500/5 text-primary-600'
                  : 'border-(--ui-border)/40 text-(--ui-text-muted) hover:bg-(--ui-bg-elevated)'
                "
                @click="exportFormat = 'epub'"
              >
                <Icon
                  icon="lucide:book-open"
                  class="mx-auto mb-1 size-5"
                />
                <p class="text-xs">EPUB</p>
              </button>
            </div>
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">
            导出内容包含小说标题、简介、所有章节正文。EPUB
            格式可在电子书阅读器中打开。
          </p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <NButton
              size="small"
              @click="showExportDialog = false"
              >取消</NButton
            >
            <NButton
              type="primary"
              size="small"
              :loading="exporting"
              @click="exportNovel"
            >
              <template #icon><Icon icon="lucide:download" /></template>
              导出
            </NButton>
          </div>
        </template>
      </NModal>

      <!-- AI Settings Modal -->
      <NModal
        v-model:show="showAiSettingsModal"
        preset="card"
        title="AI 与世界观设定"
        style="max-width: 480px"
      >
        <p class="mb-4 text-sm text-(--ui-text-muted)">
          配置本小说的世界观、风格与 AI
          生成参数。这些设定会作为章节生成、续写、审核等所有写作操作的上下文。
        </p>
        <div class="space-y-4">
          <NFormItem label="世界观设定">
            <NInput
              v-model:value="aiSettingsForm.worldSetting"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }"
              placeholder="描述故事发生的世界背景、时代、规则、地理等"
            />
            <template #feedback>
              故事的世界背景设定，会作为生成、角色、大纲等 AI 操作的重要上下文。
            </template>
          </NFormItem>
          <NFormItem label="风格指南">
            <NInput
              v-model:value="aiSettingsForm.styleGuide"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="例如：叙事节奏明快，多用短句，对白生动"
            />
            <template #feedback>
              整体写作风格约定，用于审核与生成时保持风格一致。
            </template>
          </NFormItem>
          <NFormItem label="内容生成模型">
            <NSelect
              v-model:value="aiSettingsForm.aiConfigId"
              :options="aiConfigOptions"
              placeholder="不指定，使用系统默认模型"
              clearable
            />
            <template #feedback>
              为本小说指定专用的内容生成模型。未指定时将使用设置中标记为默认的生成模型。可在「设置
              → AI 模型」中管理模型列表。
            </template>
          </NFormItem>
          <div class="grid gap-4 sm:grid-cols-2">
            <NFormItem label="Temperature">
              <NInput
                v-model:value="aiSettingsForm.aiTemperature"
                placeholder="留空继承"
              />
              <template #feedback>控制随机性，范围随模型能力变化。</template>
            </NFormItem>
            <NFormItem label="top_p">
              <NInput
                v-model:value="aiSettingsForm.aiTopP"
                placeholder="留空继承"
              />
              <template #feedback>控制候选词采样范围，通常为 0.01~1。</template>
            </NFormItem>
          </div>
          <div
            v-if="selectedNovelAiConfig?.aiModel.supportsThinking"
            class="grid gap-4 sm:grid-cols-2"
          >
            <NFormItem label="思考模式">
              <NCheckbox
                :checked="aiSettingsForm.aiThinkingEnabled === true"
                @update:checked="
                  (checked) => {
                    aiSettingsForm.aiThinkingEnabled = checked ? true : false
                  }
                "
              >
                启用思考
              </NCheckbox>
            </NFormItem>
            <NFormItem label="思考强度">
              <NSelect
                v-model:value="aiSettingsForm.aiReasoningEffort"
                :options="reasoningOptions"
                clearable
                placeholder="留空继承"
              />
            </NFormItem>
          </div>
          <NFormItem label="额外提示词">
            <NInput
              v-model:value="aiSettingsForm.aiExtraPrompt"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 6 }"
              placeholder="例如：请使用第一人称叙述，语言风格偏向轻松幽默"
            />
            <template #feedback>
              会附加到每次 AI
              生成请求中，用于统一本小说的写作风格或添加特殊要求。
            </template>
          </NFormItem>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <NButton
              size="small"
              @click="showAiSettingsModal = false"
            >
              取消
            </NButton>
            <NButton
              type="primary"
              size="small"
              :loading="savingAiSettings"
              @click="saveAiSettings"
            >
              保存
            </NButton>
          </div>
        </template>
      </NModal>
    </div>
    <div
      v-else
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <Icon
        icon="lucide:book-x"
        class="size-12 text-(--ui-text-dimmed)/50 mb-4"
      />
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
        小说未找到
      </h2>
      <p class="mt-1 text-sm text-(--ui-text-muted)">该小说不存在或已被删除</p>
      <NButton
        class="mt-4"
        size="small"
        @click="closeAndGoHome"
      >
        返回仪表盘
      </NButton>
    </div>

    <!-- Character Detail Modal -->
    <NModal
      v-model:show="showCharacterDetail"
      preset="card"
      :title="detailCharacter?.name || '角色详情'"
      style="max-width: 600px; max-height: 85vh"
    >
      <div
        v-if="detailCharacter"
        class="space-y-4 overflow-y-auto max-h-[65vh]"
      >
        <div
          v-if="detailCharacter.description"
          class="space-y-1"
        >
          <p class="text-xs font-medium text-(--ui-text-dimmed)">简介</p>
          <p class="text-sm leading-relaxed text-(--ui-text)">
            {{ detailCharacter.description }}
          </p>
        </div>

        <div
          v-if="
            detailCharacter.realName ||
            detailCharacter.displayTitle ||
            detailCharacter.rolePosition ||
            detailCharacter.storyRole
          "
          class="grid gap-3 sm:grid-cols-2"
        >
          <div
            v-if="detailCharacter.realName"
            class="space-y-1"
          >
            <p class="text-xs font-medium text-(--ui-text-dimmed)">本名</p>
            <p class="text-sm leading-relaxed text-(--ui-text)">
              {{ detailCharacter.realName }}
            </p>
          </div>
          <div
            v-if="detailCharacter.displayTitle"
            class="space-y-1"
          >
            <p class="text-xs font-medium text-(--ui-text-dimmed)">称呼/位分</p>
            <p class="text-sm leading-relaxed text-(--ui-text)">
              {{ detailCharacter.displayTitle }}
            </p>
          </div>
          <div
            v-if="detailCharacter.rolePosition"
            class="space-y-1"
          >
            <p class="text-xs font-medium text-(--ui-text-dimmed)">身份定位</p>
            <p class="text-sm leading-relaxed text-(--ui-text)">
              {{ detailCharacter.rolePosition }}
            </p>
          </div>
          <div
            v-if="detailCharacter.storyRole"
            class="space-y-1"
          >
            <p class="text-xs font-medium text-(--ui-text-dimmed)">剧情作用</p>
            <p class="text-sm leading-relaxed text-(--ui-text)">
              {{ detailCharacter.storyRole }}
            </p>
          </div>
        </div>

        <div
          v-if="detailCharacter.traits"
          class="space-y-1"
        >
          <p class="text-xs font-medium text-(--ui-text-dimmed)">性格特征</p>
          <p class="text-sm leading-relaxed text-(--ui-text)">
            {{ detailCharacter.traits }}
          </p>
        </div>

        <div
          v-if="detailCharacter.relationships"
          class="space-y-1"
        >
          <p class="text-xs font-medium text-(--ui-text-dimmed)">人物关系</p>
          <p class="text-sm leading-relaxed text-(--ui-text)">
            {{ detailCharacter.relationships }}
          </p>
        </div>

        <div
          v-if="detailCharacter.currentState"
          class="space-y-1"
        >
          <p class="text-xs font-medium text-(--ui-text-dimmed)">当前状态</p>
          <p class="text-sm leading-relaxed text-(--ui-text)">
            {{ detailCharacter.currentState }}
          </p>
        </div>

        <div
          v-if="detailCharacter.overallArc"
          class="space-y-1"
        >
          <p class="text-xs font-medium text-(--ui-text-dimmed)">故事弧线</p>
          <p
            class="text-sm leading-relaxed text-(--ui-text) whitespace-pre-wrap"
          >
            {{ detailCharacter.overallArc }}
          </p>
        </div>

        <div class="flex flex-wrap gap-3 text-xs text-(--ui-text-dimmed)">
          <span v-if="detailCharacter.firstAppearanceChapter"
            >首次出场：第{{ detailCharacter.firstAppearanceChapter }}章</span
          >
          <span v-if="detailCharacter.lastAppearanceChapter"
            >最近出场：第{{ detailCharacter.lastAppearanceChapter }}章</span
          >
          <span>出场 {{ detailCharacter.appearances.length }} 次</span>
        </div>

        <div class="border-t border-(--ui-border) pt-3">
          <NovelCharacterStateTimeline
            :novel-id="novelId"
            :character-id="detailCharacter.id"
            @refreshed="refreshDetailCharacter"
          />
        </div>

        <div
          v-if="detailCharacter.appearances.length"
          class="border-t border-(--ui-border) pt-3 space-y-2"
        >
          <p class="text-xs font-medium text-(--ui-text-dimmed)">出场记录</p>
          <div
            v-for="app in detailCharacter.appearances"
            :key="`${app.chapterId}-${app.id}`"
            class="rounded-lg bg-(--ui-bg-muted) px-3 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <NuxtLink
                :to="`/novels/${novel?.id}/chapters/${app.chapterId}`"
                class="text-xs font-medium text-primary-600 hover:underline"
              >
                Ch.{{ app.chapterNumber }} {{ app.chapterTitle }}
              </NuxtLink>
              <span class="text-[10px] text-(--ui-text-dimmed)">{{
                getRoleLabel(app.role)
              }}</span>
            </div>
            <p
              v-if="app.background || app.snippet"
              class="mt-1 text-xs leading-relaxed text-(--ui-text-muted)"
            >
              {{ app.background || app.snippet }}
            </p>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            size="small"
            @click="editDetailCharacter"
          >
            <template #icon
              ><Icon
                icon="lucide:pencil"
                class="w-3.5 h-3.5"
            /></template>
            编辑
          </NButton>
          <NButton
            size="small"
            @click="showCharacterDetail = false"
            >关闭</NButton
          >
        </div>
      </template>
    </NModal>
  </div>
</template>

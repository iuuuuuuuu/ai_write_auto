<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const message = useMessage()
const { post, put, del: apiDel } = useApi()
const { startStream } = useAiStream()
const { updateActiveTabTitle, removeTab, activeTab, setActiveTab } = useTabs('user')

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
  aiExtraPrompt: string | null
  createdAt: string
  updatedAt: string
  aiConfigId: number | null
  aiConfigName: string | null
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
  overallArc: string | null
  firstAppearanceChapter: number | null
  lastAppearanceChapter: number | null
  createdAt: string
  appearances: CharacterAppearanceItem[]
}

type CharacterFormModel = Partial<{
  name: string
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

interface GenerateOutlineForm {
  idea: string
  chapterCount: number
}

interface GenerateOutlineResponse {
  outlines: Array<{
    chapterNumber: number
    description: string
    sortOrder?: number
  }>
  raw?: string
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
  Array<{ id: number; purpose: string; enabled: boolean; aiModel: { id: number; name: string; model: string; enabled: boolean } }>
>('/api/ai/config', { default: () => [] })

const aiConfigOptions = computed(() => {
  return aiConfigs.value
    .filter((c) => c.purpose === 'generation' && c.enabled && c.aiModel?.enabled)
    .map((c) => ({ label: `${c.aiModel.name} (${c.aiModel.model})`, value: c.id }))
})

const showAiSettingsModal = shallowRef(false)
const savingAiSettings = shallowRef(false)
const aiSettingsForm = reactive({
  aiConfigId: null as number | null,
  aiTemperature: '',
  aiExtraPrompt: ''
})

function openAiSettings() {
  aiSettingsForm.aiConfigId = novel.value?.aiConfigId ?? null
  aiSettingsForm.aiTemperature = novel.value?.aiTemperature || ''
  aiSettingsForm.aiExtraPrompt = novel.value?.aiExtraPrompt || ''
  showAiSettingsModal.value = true
}

async function saveAiSettings() {
  savingAiSettings.value = true
  try {
    await put(`/api/novels/${novelId.value}`, {
      aiConfigId: aiSettingsForm.aiConfigId,
      aiTemperature: aiSettingsForm.aiTemperature || undefined,
      aiExtraPrompt: aiSettingsForm.aiExtraPrompt || undefined
    }, { successMessage: 'AI 设定已保存' })
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

const { data: chapters } = await useFetch<ChapterItem[]>(
  `/api/novels/${novelId.value}/chapters`,
  { immediate: !!novel.value, default: () => [] }
)
const { data: outlines, refresh: refreshOutlines } = await useFetch<
  OutlineItem[]
>(`/api/novels/${novelId.value}/outlines`, { immediate: !!novel.value, default: () => [] })
const { data: characters, refresh: refreshCharacters } = await useFetch<
  CharacterItem[]
>(`/api/novels/${novelId.value}/characters`, { immediate: !!novel.value, default: () => [] })
const { confirmDelete } = useConfirmDialog()

const showCharacterDialog = ref(false)
const showNewChapterDialog = ref(false)
const newChapterTitle = ref('')
const creatingChapter = ref(false)
const editingCharacterId = ref<number | null>(null)
const savingCharacter = ref(false)
const characterFormRef = ref<{ validate: () => Promise<void> } | null>(null)
const chapterSearchQuery = shallowRef('')
const chapterStatusFilter = shallowRef<ChapterStatusFilter>('all')
const editingOutlines = shallowRef(false)
const savingOutlines = shallowRef(false)
const outlineFormItems = ref<OutlineFormItem[]>([])
const showGenerateOutlineDialog = shallowRef(false)
const showRegenerateOutlineDialog = shallowRef(false)
const generatingOutline = shallowRef(false)
const outlineStreamText = ref('')
const outlineStreamParsed = ref<Array<{ chapterNumber: number; description: string }>>([])

const outlineStreamItems = computed(() => {
  const text = outlineStreamText.value
  const items: Array<{ chapterNumber: number; description: string }> = []
  const regex = /\{\s*"chapterNumber"\s*:\s*(\d+)\s*,\s*"description"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g
  let match
  while ((match = regex.exec(text)) !== null) {
    items.push({ chapterNumber: parseInt(match[1]!), description: match[2]!.replace(/\\"/g, '"').replace(/\\n/g, '\n') })
  }
  return items
})
const generateOutlineForm = reactive<GenerateOutlineForm>({
  idea: '',
  chapterCount: 20
})
const regenerateOutlineForm = reactive({
  startChapter: 1,
  chapterCount: 10,
  idea: ''
})
const characterSearchQuery = shallowRef('')
const characterAppearanceFilter = shallowRef<CharacterAppearanceFilter>('all')
const expandedCharacterIds = shallowRef<number[]>([])
const characterViewMode = shallowRef<'cards' | 'graph'>('cards')
const characterForm = reactive<CharacterFormModel>({
  name: '',
  description: '',
  traits: '',
  relationships: ''
})

// Setup guide
const setupGuideDismissed = ref(false)
const setupStep1Done = computed(() => !!(novel.value?.worldSetting || novel.value?.styleGuide))
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
  navigateTo('/dashboard')
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

const genreColor = (genre: string | null) => {
  const colors: Record<string, string> = {
    fantasy: '#d97706',
    scifi: '#0891b2',
    romance: '#e11d48',
    mystery: '#4f46e5',
    horror: '#dc2626',
    historical: '#c2410c',
    wuxia: '#059669',
    urban: '#475569',
    other: '#94a3b8'
  }
  return colors[genre || ''] || colors.other
}

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
  return [...(outlines.value || [])].sort((left, right) => {
    return (
      left.sortOrder - right.sortOrder ||
      left.chapterNumber - right.chapterNumber
    )
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

function handleChapterDragStart(index: number) {
  draggingChapterIndex.value = index
}

function handleChapterDragOver(event: DragEvent, index: number) {
  event.preventDefault()
  if (draggingChapterIndex.value === null || draggingChapterIndex.value === index) return
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
    await put(`/api/novels/${novelId.value}/chapters/reorder`, { orderedIds }, { successMessage: '章节顺序已保存' })
    chapters.value = chapters.value.map((c, i) => ({ ...c, chapterNumber: i + 1 }))
    chapterReorderMode.value = false
  } catch {
    // useApi handles error display
  } finally {
    savingChapterOrder.value = false
  }
}

async function createNewChapter() {
  if (!newChapterTitle.value.trim()) {
    message.warning('请输入章节标题')
    return
  }
  creatingChapter.value = true
  try {
    const nextNumber = (chapters.value?.length || 0) + 1
    const result = await post<{ id: number }>(`/api/novels/${novelId.value}/chapters`, {
      title: newChapterTitle.value.trim(),
      chapterNumber: nextNumber
    })
    showNewChapterDialog.value = false
    navigateTo(`/novels/${novelId.value}/chapters/${result.id}`)
  } catch {
    // useApi handles error display
  } finally {
    creatingChapter.value = false
  }
}

function openNewChapterDialog() {
  const nextNumber = (chapters.value?.length || 0) + 1
  newChapterTitle.value = `第${nextNumber}章`
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
    await put(`/api/novels/${novelId.value}/outlines`, { outlines: validOutlines }, { successMessage: '大纲已保存' })
    editingOutlines.value = false
    await refreshOutlines()
    resetOutlineFormItems()
  } catch {
    // useApi handles error display
  } finally {
    savingOutlines.value = false
  }
}

function openGenerateOutlineDialog() {
  generateOutlineForm.idea =
    novel.value?.description || novel.value?.title || ''
  generateOutlineForm.chapterCount = Math.max(chapters.value?.length || 20, 3)
  showGenerateOutlineDialog.value = true
}

function openRegenerateOutlineDialog(startChapter?: number) {
  regenerateOutlineForm.startChapter = startChapter || Math.max((chapters.value?.length || 0) + 1, 1)
  regenerateOutlineForm.chapterCount = Math.max((sortedOutlines.value.length || 20) - regenerateOutlineForm.startChapter + 1, 3)
  regenerateOutlineForm.idea = novel.value?.description || novel.value?.title || ''
  showRegenerateOutlineDialog.value = true
}

async function regenerateOutlinesFromChapter() {
  const idea = regenerateOutlineForm.idea.trim()
  if (!idea) {
    message.warning('请输入故事核心想法')
    return
  }

  generatingOutline.value = true
  outlineStreamText.value = ''
  try {
    await startStream({
      url: '/api/ai/generate-outline',
      body: {
        novelId: novelId.value,
        idea,
        chapterCount: regenerateOutlineForm.chapterCount,
        startChapter: regenerateOutlineForm.startChapter,
        existingOutlines: sortedOutlines.value.map((outline) => ({
          chapterNumber: outline.chapterNumber,
          description: outline.description
        }))
      },
      onChunk: (chunk) => { outlineStreamText.value += chunk },
      onDone: (fullContent, parsedJson) => {
        try {
          const parsed = parsedJson || JSON.parse((fullContent.match(/\[[\s\S]*\]/) || [fullContent])[0])
          const outlines = Array.isArray(parsed) ? parsed : (parsed.outlines || [])
          if (!outlines.length) {
            message.warning('AI 未返回可用大纲')
            return
          }
          const preserved = sortedOutlines.value
            .filter((outline) => outline.chapterNumber < regenerateOutlineForm.startChapter)
            .map((outline, index) => ({
              chapterNumber: outline.chapterNumber,
              description: outline.description,
              sortOrder: index
            }))
          const regenerated = outlines.map((outline: any, index: number) => ({
            chapterNumber: outline.chapterNumber,
            description: outline.description,
            sortOrder: preserved.length + index
          }))
          outlineFormItems.value = [...preserved, ...regenerated]
          editingOutlines.value = true
          showRegenerateOutlineDialog.value = false
          message.success('后续大纲已重新生成，请确认后保存')
        } catch {
          message.warning('AI 返回格式异常')
        }
      },
      onError: (err) => { message.error(err) }
    })
  } finally {
    generatingOutline.value = false
  }
}


async function generateOutlines() {
  const idea = generateOutlineForm.idea.trim()
  if (!idea) {
    message.warning('请输入故事核心想法')
    return
  }

  generatingOutline.value = true
  outlineStreamText.value = ''
  try {
    await startStream({
      url: '/api/ai/generate-outline',
      body: {
        novelId: novelId.value,
        idea,
        chapterCount: generateOutlineForm.chapterCount
      },
      onChunk: (chunk) => { outlineStreamText.value += chunk },
      onDone: (fullContent, parsedJson) => {
        try {
          const parsed = parsedJson || JSON.parse((fullContent.match(/\[[\s\S]*\]/) || [fullContent])[0])
          const outlines = Array.isArray(parsed) ? parsed : (parsed.outlines || [])
          if (!outlines.length) {
            message.warning('AI 未返回可用大纲')
            return
          }
          outlineFormItems.value = outlines.map((outline: any, index: number) => ({
            chapterNumber: outline.chapterNumber,
            description: outline.description,
            sortOrder: outline.sortOrder ?? index
          }))
          editingOutlines.value = true
          showGenerateOutlineDialog.value = false
          message.success('大纲已生成，请确认后保存')
        } catch {
          message.warning('AI 返回格式异常')
        }
      },
      onError: (err) => { message.error(err) }
    })
  } finally {
    generatingOutline.value = false
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
      `${character.name} ${character.description || ''} ${character.traits || ''} ${character.currentState || ''} ${character.relationships || ''} ${character.firstAppearanceChapter || ''} ${character.lastAppearanceChapter || ''} ${appearancesText}`
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
  return characters.value?.find((c: CharacterItem) => c.id === editingCharacterId.value) ?? null
})

function resetCharacterForm() {
  editingCharacterId.value = null
  characterForm.name = ''
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
  characterForm.description = character.description || ''
  characterForm.traits = character.traits || ''
  characterForm.relationships = character.relationships || ''
  showCharacterDialog.value = true
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
      await post(`/api/novels/${novelId.value}/characters`, payload, { successMessage: '角色已创建' })
    }
    showCharacterDialog.value = false
    await refreshCharacters()
  } catch {
    // useApi handles error display
  } finally {
    savingCharacter.value = false
  }
}

async function deleteCharacter(character: CharacterItem) {
  const confirmed = await confirmDelete(character.name)
  if (!confirmed) return
  try {
    await apiDel(`/api/novels/${novelId.value}/characters/${character.id}`, { successMessage: '角色已删除', silent: true })
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
  { label: '默认提示词', value: 0 },
  ...(characterPrompts.value || []).map((p) => ({ label: p.name, value: p.id }))
])

function openGenerateDialog() {
  generateCount.value = 3
  generatePromptId.value = 0
  showGenerateDialog.value = true
}

async function generateCharacters() {
  generating.value = true
  characterStreamText.value = ''
  try {
    await startStream({
      url: `/api/novels/${novelId.value}/characters/generate`,
      body: {
        count: generateCount.value,
        promptTemplateId: generatePromptId.value || undefined
      },
      onChunk: (chunk) => { characterStreamText.value += chunk },
      onDone: async (fullContent, parsedJson) => {
        try {
          const parsed = parsedJson || JSON.parse((fullContent.match(/\[[\s\S]*\]/) || [fullContent])[0])
          if (!Array.isArray(parsed) || !parsed.length) {
            message.warning('AI 未返回可用角色')
            return
          }
          await post(`/api/novels/${novelId.value}/characters-batch`, { characters: parsed })
          message.success(`成功生成 ${parsed.length} 个角色`)
          showGenerateDialog.value = false
          await refreshCharacters()
        } catch {
          message.warning('AI 返回格式异常')
        }
      },
      onError: (err) => { message.error(err) }
    })
  } finally {
    generating.value = false
  }
}

const { data: plotPoints, refresh: refreshPlotPoints } = await useFetch<
  PlotPointItem[]
>(`/api/novels/${novelId.value}/plot-points`, { immediate: !!novel.value, default: () => [] })

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
    await post(`/api/novels/${novelId.value}/plot-points`, {
      description,
      type: plotPointForm.type,
      status: plotPointForm.status,
      chapterId: plotPointForm.chapterId || undefined
    }, { successMessage: '情节线索已添加' })
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
  <div class="mx-auto max-w-[1600px] 2xl:px-2">
    <div
      v-if="novel"
      class="space-y-4"
    >
    <section class="card-glass p-4 lg:p-5">
      <div
        class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]"
      >
        <div class="min-w-0">
          <div
            class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
          >
            <div class="min-w-0">
              <div class="mb-2 flex flex-wrap items-center gap-2">
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
              <h1
                class="text-2xl font-semibold text-(--ui-text-highlighted) lg:text-3xl"
              >
                {{ novel.title }}
              </h1>
              <p
                class="mt-2 max-w-4xl text-sm leading-relaxed text-(--ui-text-muted)"
              >
                {{ novel.description || '暂无简介' }}
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
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
                @click="
                  chapters?.length
                    ? navigateTo(`/novels/${novel.id}/chapters/${chapters[0]!.id}`)
                    : openNewChapterDialog()
                "
              >
                <template #icon><Icon icon="lucide:pen-tool" /></template>
                继续写作
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
          </div>

          <div
            class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
          >
            <div class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">章节</p>
              <p class="mt-0.5 font-mono text-lg text-(--ui-text-highlighted)">
                {{ chapters?.length || 0 }}
              </p>
            </div>
            <div class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">字数</p>
              <p class="mt-0.5 font-mono text-lg text-(--ui-text-highlighted)">
                {{ totalWords.toLocaleString() }}
              </p>
            </div>
            <div class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">角色</p>
              <p class="mt-0.5 font-mono text-lg text-(--ui-text-highlighted)">
                {{ sortedCharacters.length }}
              </p>
            </div>
            <div class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">出场</p>
              <p class="mt-0.5 font-mono text-lg text-(--ui-text-highlighted)">
                {{ characterChapterCount }}
              </p>
            </div>
            <div class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">状态</p>
              <p class="mt-1 truncate text-sm text-(--ui-text-highlighted)">
                {{ statusLabel }}
              </p>
            </div>
            <div class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">更新</p>
              <p class="mt-1 truncate text-sm text-(--ui-text-highlighted)">
                {{ formatDate(novel.updatedAt) }}
              </p>
            </div>
          </div>
        </div>

        <aside
          class="cursor-pointer rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3.5 transition-shadow hover:ring-(--ui-border-active)"
          @click="openAiSettings"
        >
          <div class="mb-3 flex items-center gap-2">
            <Icon
              icon="lucide:sparkles"
              class="size-4 text-primary-500"
            />
            <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
              AI 设定
            </h2>
            <Icon
              icon="lucide:pencil"
              class="ml-auto size-3.5 text-(--ui-text-dimmed)"
            />
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-md bg-(--ui-bg-elevated)/70 p-2">
              <p class="text-(--ui-text-dimmed)">Temperature</p>
              <p class="mt-1 font-mono text-(--ui-text-highlighted)">
                {{ novel.aiTemperature || '默认' }}
              </p>
            </div>
            <div class="rounded-md bg-(--ui-bg-elevated)/70 p-2">
              <p class="text-(--ui-text-dimmed)">模型</p>
              <p class="mt-1 truncate text-(--ui-text-highlighted)">
                {{ novel.aiConfigName || '未设置' }}
              </p>
            </div>
          </div>
          <div
            v-if="novel.aiExtraPrompt"
            class="mt-2 rounded-md bg-(--ui-bg-elevated)/70 p-2"
          >
            <p class="text-xs text-(--ui-text-dimmed)">额外提示</p>
            <p
              class="mt-1 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-(--ui-text-muted)"
            >
              {{ novel.aiExtraPrompt }}
            </p>
          </div>
          <p
            v-else
            class="mt-2 rounded-md bg-(--ui-bg-elevated)/70 p-2 text-xs text-(--ui-text-dimmed)"
          >
            暂未配置额外提示
          </p>
        </aside>
      </div>

      <div
        v-if="novel.styleGuide || novel.worldSetting"
        class="mt-4 grid gap-3 xl:grid-cols-2"
      >
        <section
          v-if="novel.styleGuide"
          class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3"
        >
          <div class="mb-1.5 flex items-center gap-2">
            <Icon
              icon="lucide:palette"
              class="size-3.5 text-amber-500"
            />
            <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
              风格指南
            </h2>
          </div>
          <p
            class="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-(--ui-text-muted)"
          >
            {{ novel.styleGuide }}
          </p>
        </section>
        <section
          v-if="novel.worldSetting"
          class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3"
        >
          <div class="mb-1.5 flex items-center gap-2">
            <Icon
              icon="lucide:globe"
              class="size-3.5 text-blue-500"
            />
            <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
              世界观
            </h2>
          </div>
          <p
            class="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-(--ui-text-muted)"
          >
            {{ novel.worldSetting }}
          </p>
        </section>
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
          <h2 class="font-semibold text-(--ui-text-highlighted)">快速设定引导</h2>
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
        完成以下步骤可以帮助 AI 更好地理解你的故事，生成更连贯的内容。每步都可跳过，随时回来补充。
      </p>
      <div class="grid gap-3 sm:grid-cols-3">
        <div
          class="rounded-xl p-4 ring-1 transition-colors"
          :class="setupStep1Done ? 'bg-green-500/5 ring-green-500/30' : 'bg-(--ui-bg-muted) ring-(--ui-border) hover:ring-(--ui-border-active)'"
        >
          <div class="mb-2 flex items-center gap-2">
            <div
              class="flex size-6 items-center justify-center rounded-full text-xs font-bold"
              :class="setupStep1Done ? 'bg-green-500/20 text-green-600' : 'bg-primary-500/20 text-primary-500'"
            >
              {{ setupStep1Done ? '✓' : '1' }}
            </div>
            <span class="text-sm font-medium text-(--ui-text-highlighted)">世界观设定</span>
          </div>
          <p class="mb-3 text-xs text-(--ui-text-muted)">
            描述故事发生的世界背景，AI 可辅助扩展。
          </p>
          <NButton
            v-if="!setupStep1Done"
            size="tiny"
            type="primary"
            @click="showAiSettingsModal = true"
          >
            去设定
          </NButton>
          <span
            v-else
            class="text-xs text-green-600"
          >已完成</span>
        </div>

        <div
          class="rounded-xl p-4 ring-1 transition-colors"
          :class="setupStep2Done ? 'bg-green-500/5 ring-green-500/30' : 'bg-(--ui-bg-muted) ring-(--ui-border) hover:ring-(--ui-border-active)'"
        >
          <div class="mb-2 flex items-center gap-2">
            <div
              class="flex size-6 items-center justify-center rounded-full text-xs font-bold"
              :class="setupStep2Done ? 'bg-green-500/20 text-green-600' : 'bg-primary-500/20 text-primary-500'"
            >
              {{ setupStep2Done ? '✓' : '2' }}
            </div>
            <span class="text-sm font-medium text-(--ui-text-highlighted)">创建角色</span>
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
          >已完成</span>
        </div>

        <div
          class="rounded-xl p-4 ring-1 transition-colors"
          :class="setupStep3Done ? 'bg-green-500/5 ring-green-500/30' : 'bg-(--ui-bg-muted) ring-(--ui-border) hover:ring-(--ui-border-active)'"
        >
          <div class="mb-2 flex items-center gap-2">
            <div
              class="flex size-6 items-center justify-center rounded-full text-xs font-bold"
              :class="setupStep3Done ? 'bg-green-500/20 text-green-600' : 'bg-primary-500/20 text-primary-500'"
            >
              {{ setupStep3Done ? '✓' : '3' }}
            </div>
            <span class="text-sm font-medium text-(--ui-text-highlighted)">规划大纲</span>
          </div>
          <p class="mb-3 text-xs text-(--ui-text-muted)">
            用 AI 生成章节大纲，为写作提供方向。
          </p>
          <NButton
            v-if="!setupStep3Done"
            size="tiny"
            type="primary"
            @click="openGenerateOutlineDialog"
          >
            生成大纲
          </NButton>
          <span
            v-else
            class="text-xs text-green-600"
          >已完成</span>
        </div>
      </div>
    </section>

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
            <h2 class="font-semibold text-(--ui-text-highlighted)">章节大纲</h2>
          </div>
          <p class="mt-1 text-xs text-(--ui-text-dimmed)">
            {{ sortedOutlines.length }} 条大纲，可用于后续章节生成
          </p>
        </div>
        <div class="flex gap-2">
          <NButton
            size="tiny"
            @click="openGenerateOutlineDialog"
          >
            <template #icon><Icon icon="lucide:sparkles" /></template>
            AI 生成
          </NButton>
          <NButton
            size="tiny"
            @click="() => openRegenerateOutlineDialog()"
          >
            <template #icon><Icon icon="lucide:refresh-cw" /></template>
            重新规划后续
          </NButton>
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
        v-if="editingOutlines"
        class="space-y-2"
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
        暂无章节大纲，可手动编辑或使用 AI 生成。
      </div>

      <div
        v-else
        class="grid gap-2 md:grid-cols-2 xl:grid-cols-3"
      >
        <article
          v-for="outline in sortedOutlines"
          :key="`${outline.chapterNumber}-${outline.sortOrder}`"
          class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3"
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
            <h2 class="font-semibold text-(--ui-text-highlighted)">情节线索</h2>
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
        v-if="!plotPoints?.length"
        class="rounded-lg bg-(--ui-bg-muted)/30 py-8 text-center text-sm text-(--ui-text-muted)"
      >
        暂无情节点，可手动添加以追踪故事中的关键事件。
      </div>

      <div
        v-else
        class="space-y-2"
      >
        <div
          v-for="point in plotPoints"
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

    <div
      class="stagger-children grid gap-4 xl:grid-cols-[minmax(520px,0.92fr)_minmax(640px,1.08fr)]"
    >
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
              <NButton
                v-if="!chapterReorderMode && chapters && chapters.length > 1"
                size="tiny"
                quaternary
                @click="chapterReorderMode = true"
              >
                <template #icon><Icon icon="lucide:arrow-up-down" /></template>
                排序
              </NButton>
              <NButton
                size="tiny"
                type="primary"
                @click="openNewChapterDialog"
              >
                <template #icon><Icon icon="lucide:plus" /></template>
                新建章节
              </NButton>
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
                <p class="min-w-0 truncate text-sm font-medium text-(--ui-text-highlighted)">
                  {{ chapter.title }}
                </p>
              </div>
            </div>
            <NuxtLink
              v-else
              :to="`/novels/${novel.id}/chapters/${chapter.id}`"
              class="group grid gap-3 rounded-lg p-3 transition-colors hover:bg-(--ui-bg-elevated)/60 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
            >
              <div
                class="flex size-9 items-center justify-center rounded-lg bg-primary-400/10 text-xs font-semibold font-mono text-primary-500 shrink-0"
              >
                {{ chapter.chapterNumber }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p
                    class="min-w-0 truncate text-sm font-medium text-(--ui-text-highlighted)"
                  >
                    {{ chapter.title }}
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
      </section>

      <section
        class="card-glass flex min-h-[620px] flex-col overflow-hidden p-4 lg:p-5"
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
              <div class="flex rounded-md bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-0.5 gap-0.5">
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

        <div v-show="characterViewMode === 'cards'">
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
            class="mt-4 grid max-h-[calc(100dvh-260px)] min-h-0 gap-3 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3"
          >
            <article
              v-for="character in filteredCharacters"
              :key="character.id"
              class="flex min-h-[250px] flex-col rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3 transition-all duration-200 hover:bg-(--ui-bg-muted) hover:-translate-y-0.5 hover:shadow-md"
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
                          class="rounded bg-(--ui-bg-elevated) px-1.5 py-0.5 text-(--ui-text-muted)"
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
                <div class="grid gap-2 sm:grid-cols-2">
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
                <p class="text-[10px] font-medium text-primary-500/80">
                  故事弧线
                </p>
                <p
                  class="mt-0.5 line-clamp-3 leading-relaxed text-(--ui-text-muted)"
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
      <NInput
        v-model:value="newChapterTitle"
        placeholder="请输入章节标题"
        @keydown.enter="createNewChapter"
      />
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showNewChapterDialog = false">取消</NButton>
          <NButton type="primary" :loading="creatingChapter" @click="createNewChapter">
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
          v-if="editingCharacterData && (editingCharacterData.currentState || editingCharacterData.firstAppearanceChapter || editingCharacterData.lastAppearanceChapter)"
          class="rounded-md bg-(--ui-bg-elevated) p-3 text-sm text-(--ui-text-muted)"
        >
          <div class="mb-1.5 text-xs font-medium">以下字段由系统根据章节内容自动维护</div>
          <div v-if="editingCharacterData.currentState" class="mb-1">
            <span class="font-medium text-(--ui-text)">当前状态：</span>{{ editingCharacterData.currentState }}
          </div>
          <div v-if="editingCharacterData.firstAppearanceChapter" class="mb-1">
            <span class="font-medium text-(--ui-text)">首次出现：</span>第 {{ editingCharacterData.firstAppearanceChapter }} 章
          </div>
          <div v-if="editingCharacterData.lastAppearanceChapter">
            <span class="font-medium text-(--ui-text)">最近出现：</span>第 {{ editingCharacterData.lastAppearanceChapter }} 章
          </div>
        </div>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
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

    <!-- AI Generate Outline Dialog -->
    <NModal
      v-model:show="showGenerateOutlineDialog"
      preset="card"
      title="AI 生成大纲"
      class="max-w-md"
      :mask-closable="!generatingOutline"
      :close-on-esc="!generatingOutline"
      :closable="!generatingOutline"
    >
      <div class="space-y-4">
        <template v-if="generatingOutline">
          <div class="max-h-72 overflow-y-auto space-y-2">
            <div v-if="!outlineStreamItems.length" class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-4 justify-center">
              <Icon icon="lucide:loader-2" class="w-4 h-4 animate-spin" />
              <span>正在生成大纲...</span>
            </div>
            <div
              v-for="item in outlineStreamItems"
              :key="item.chapterNumber"
              class="flex gap-2 p-2 rounded-md bg-(--ui-bg-elevated)"
            >
              <span class="shrink-0 w-7 h-7 rounded-full bg-(--ui-primary)/10 text-(--ui-primary) flex items-center justify-center text-xs font-medium">{{ item.chapterNumber }}</span>
              <p class="text-sm text-(--ui-text) leading-relaxed pt-0.5">{{ item.description }}</p>
            </div>
            <div v-if="outlineStreamItems.length" class="flex items-center gap-1 text-xs text-(--ui-text-dimmed) pt-1">
              <Icon icon="lucide:loader-2" class="w-3 h-3 animate-spin" />
              <span>已生成 {{ outlineStreamItems.length }} 章...</span>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-(--ui-text)"
              >故事核心想法</label
            >
            <NInput
              v-model:value="generateOutlineForm.idea"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 8 }"
              placeholder="输入主线目标、核心冲突、结局方向等"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-(--ui-text)">章节数量</label>
            <NInputNumber
              v-model:value="generateOutlineForm.chapterCount"
              :min="3"
              :max="200"
              class="w-full"
            />
          </div>
        </template>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton :disabled="generatingOutline" @click="showGenerateOutlineDialog = false">取消</NButton>
          <NButton
            type="primary"
            :loading="generatingOutline"
            :disabled="generatingOutline"
            @click="generateOutlines"
          >
            <template #icon><Icon icon="lucide:sparkles" /></template>
            开始生成
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- AI Regenerate Later Outlines Dialog -->
    <NModal
      v-model:show="showRegenerateOutlineDialog"
      preset="card"
      title="重新规划后续大纲"
      class="max-w-md"
      :mask-closable="!generatingOutline"
      :close-on-esc="!generatingOutline"
      :closable="!generatingOutline"
    >
      <div class="space-y-4">
        <template v-if="generatingOutline">
          <div class="max-h-72 overflow-y-auto space-y-2">
            <div v-if="!outlineStreamItems.length" class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-4 justify-center">
              <Icon icon="lucide:loader-2" class="w-4 h-4 animate-spin" />
              <span>正在生成大纲...</span>
            </div>
            <div
              v-for="item in outlineStreamItems"
              :key="item.chapterNumber"
              class="flex gap-2 p-2 rounded-md bg-(--ui-bg-elevated)"
            >
              <span class="shrink-0 w-7 h-7 rounded-full bg-(--ui-primary)/10 text-(--ui-primary) flex items-center justify-center text-xs font-medium">{{ item.chapterNumber }}</span>
              <p class="text-sm text-(--ui-text) leading-relaxed pt-0.5">{{ item.description }}</p>
            </div>
            <div v-if="outlineStreamItems.length" class="flex items-center gap-1 text-xs text-(--ui-text-dimmed) pt-1">
              <Icon icon="lucide:loader-2" class="w-3 h-3 animate-spin" />
              <span>已生成 {{ outlineStreamItems.length }} 章...</span>
            </div>
          </div>
        </template>
        <template v-else>
          <NAlert type="info" title="仅替换起始章节及之后的大纲">
            起始章节之前的大纲会被保留，生成结果需要你确认后手动保存。
          </NAlert>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-(--ui-text)">起始章节</label>
              <NInputNumber
                v-model:value="regenerateOutlineForm.startChapter"
                :min="1"
                :max="200"
                class="w-full"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-(--ui-text)">生成数量</label>
              <NInputNumber
                v-model:value="regenerateOutlineForm.chapterCount"
                :min="3"
                :max="200"
                class="w-full"
              />
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-(--ui-text)">后续规划方向</label>
            <NInput
              v-model:value="regenerateOutlineForm.idea"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 8 }"
              placeholder="描述从这一章开始的剧情目标、转折、结局方向等"
            />
          </div>
        </template>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton :disabled="generatingOutline" @click="showRegenerateOutlineDialog = false">取消</NButton>
          <NButton
            type="primary"
            :loading="generatingOutline"
            :disabled="generatingOutline"
            @click="regenerateOutlinesFromChapter"
          >
            <template #icon><Icon icon="lucide:refresh-cw" /></template>
            重新生成
          </NButton>
        </div>
      </template>
    </NModal>

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
      <div class="space-y-4">
        <template v-if="generating">
          <div class="rounded-lg bg-(--ui-bg-elevated) p-3 max-h-64 overflow-y-auto">
            <pre class="text-xs text-(--ui-text-muted) whitespace-pre-wrap font-sans leading-relaxed">{{ characterStreamText || '正在生成角色...' }}</pre>
          </div>
        </template>
        <template v-else>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-(--ui-text)">生成数量</label>
            <NInputNumber
              v-model:value="generateCount"
              :min="1"
              :max="20"
              class="w-full"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-(--ui-text)">提示词模板</label>
            <NSelect
              v-model:value="generatePromptId"
              :options="promptOptions"
              placeholder="选择提示词模板"
            />
            <p class="text-xs text-(--ui-text-dimmed)">
              管理员可在后台「提示词模板」中配置角色生成提示词
            </p>
          </div>
        </template>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton :disabled="generating" @click="showGenerateDialog = false">取消</NButton>
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
              :class="exportFormat === 'txt' ? 'border-primary-500 bg-primary-500/5 text-primary-600' : 'border-(--ui-border)/40 text-(--ui-text-muted) hover:bg-(--ui-bg-elevated)'"
              @click="exportFormat = 'txt'"
            >
              <Icon icon="lucide:file-text" class="mx-auto mb-1 size-5" />
              <p class="text-xs">TXT</p>
            </button>
            <button
              class="rounded-lg border px-3 py-3 text-center transition-colors"
              :class="exportFormat === 'md' ? 'border-primary-500 bg-primary-500/5 text-primary-600' : 'border-(--ui-border) text-(--ui-text-muted) hover:bg-(--ui-bg-muted)'"
              @click="exportFormat = 'md'"
            >
              <Icon icon="lucide:file-code" class="mx-auto mb-1 size-5" />
              <p class="text-xs">Markdown</p>
            </button>
            <button
              class="rounded-lg border px-3 py-3 text-center transition-colors"
              :class="exportFormat === 'epub' ? 'border-primary-500 bg-primary-500/5 text-primary-600' : 'border-(--ui-border)/40 text-(--ui-text-muted) hover:bg-(--ui-bg-elevated)'"
              @click="exportFormat = 'epub'"
            >
              <Icon icon="lucide:book-open" class="mx-auto mb-1 size-5" />
              <p class="text-xs">EPUB</p>
            </button>
          </div>
        </div>
        <p class="text-xs text-(--ui-text-dimmed)">
          导出内容包含小说标题、简介、所有章节正文。EPUB 格式可在电子书阅读器中打开。
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showExportDialog = false">取消</NButton>
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
      title="AI 设定"
      style="max-width: 480px"
    >
      <p class="mb-4 text-sm text-(--ui-text-muted)">
        为本小说配置专属的 AI 生成参数。章节生成、续写、扩写、改写等所有写作操作都会使用这里的设定。
      </p>
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">内容生成模型</label>
          <NSelect
            v-model:value="aiSettingsForm.aiConfigId"
            :options="aiConfigOptions"
            placeholder="不指定，使用系统默认模型"
            clearable
          />
          <p class="text-xs text-(--ui-text-dimmed)">
            为本小说指定专用的内容生成模型。未指定时将使用设置中标记为默认的生成模型。可在「设置 → AI 模型」中管理模型列表。
          </p>
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">Temperature</label>
          <NInput
            v-model:value="aiSettingsForm.aiTemperature"
            placeholder="留空使用模型配置中的值"
          />
          <p class="text-xs text-(--ui-text-dimmed)">
            控制生成内容的随机性，范围 0~2。值越高文风越多变有创意，越低则越稳定可控。推荐小说创作使用 0.7~0.9。
          </p>
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">额外提示词</label>
          <NInput
            v-model:value="aiSettingsForm.aiExtraPrompt"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder="例如：请使用第一人称叙述，语言风格偏向轻松幽默"
          />
          <p class="text-xs text-(--ui-text-dimmed)">
            会附加到每次 AI 生成请求中，用于统一本小说的写作风格或添加特殊要求。
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showAiSettingsModal = false">
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
    <div v-else class="flex flex-col items-center justify-center py-20 text-center">
      <Icon icon="lucide:book-x" class="size-12 text-(--ui-text-dimmed)/50 mb-4" />
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">小说未找到</h2>
      <p class="mt-1 text-sm text-(--ui-text-muted)">该小说不存在或已被删除</p>
      <NButton class="mt-4" size="small" @click="closeAndGoHome">
        返回仪表盘
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const message = useMessage()
const { updateActiveTabTitle } = useTabs('user')

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
  currentState: string
  firstAppearanceChapter: number | null
  lastAppearanceChapter: number | null
}>

type ChapterStatusFilter =
  | 'all'
  | 'draft'
  | 'generated'
  | 'edited'
  | 'final'
  | 'completed'

type CharacterAppearanceFilter = 'all' | 'appeared' | 'missing'

const { data: novel } = await useFetch<NovelDetail>(
  `/api/novels/${novelId.value}`
)

watch(() => novel.value, (n) => {
  if (n) updateActiveTabTitle(n.title)
}, { immediate: true })

const { data: chapters } = await useFetch<ChapterItem[]>(
  `/api/novels/${novelId.value}/chapters`
)
const { data: characters, refresh: refreshCharacters } = await useFetch<
  CharacterItem[]
>(`/api/novels/${novelId.value}/characters`, { default: () => [] })
const { confirmDelete } = useConfirmDialog()

const showCharacterDialog = ref(false)
const editingCharacterId = ref<number | null>(null)
const savingCharacter = ref(false)
const characterFormRef = ref<{ validate: () => Promise<void> } | null>(null)
const chapterSearchQuery = shallowRef('')
const chapterStatusFilter = shallowRef<ChapterStatusFilter>('all')
const characterSearchQuery = shallowRef('')
const characterAppearanceFilter = shallowRef<CharacterAppearanceFilter>('all')
const expandedCharacterIds = shallowRef<number[]>([])
const characterForm = reactive<CharacterFormModel>({
  name: '',
  description: '',
  traits: '',
  relationships: '',
  currentState: '',
  firstAppearanceChapter: null,
  lastAppearanceChapter: null
})

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

function resetCharacterForm() {
  editingCharacterId.value = null
  characterForm.name = ''
  characterForm.description = ''
  characterForm.traits = ''
  characterForm.relationships = ''
  characterForm.currentState = ''
  characterForm.firstAppearanceChapter = null
  characterForm.lastAppearanceChapter = null
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
  characterForm.currentState = character.currentState || ''
  characterForm.firstAppearanceChapter = character.firstAppearanceChapter
  characterForm.lastAppearanceChapter = character.lastAppearanceChapter
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
    relationships: characterForm.relationships?.trim() || undefined,
    currentState: characterForm.currentState?.trim() || undefined,
    firstAppearanceChapter: characterForm.firstAppearanceChapter || null,
    lastAppearanceChapter: characterForm.lastAppearanceChapter || null
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
      await $fetch(
        `/api/novels/${novelId.value}/characters/${editingCharacterId.value}`,
        { method: 'PUT', body: payload }
      )
      message.success('角色已更新')
    } else {
      await $fetch(`/api/novels/${novelId.value}/characters`, {
        method: 'POST',
        body: payload
      })
      message.success('角色已创建')
    }
    showCharacterDialog.value = false
    await refreshCharacters()
  } catch {
    message.error(editingCharacterId.value ? '角色更新失败' : '角色创建失败')
  } finally {
    savingCharacter.value = false
  }
}

async function deleteCharacter(character: CharacterItem) {
  const confirmed = await confirmDelete(character.name)
  if (!confirmed) return
  try {
    await $fetch(`/api/novels/${novelId.value}/characters/${character.id}`, {
      method: 'DELETE'
    })
    message.success('角色已删除')
    await refreshCharacters()
  } catch {
    message.error('角色删除失败')
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
const generatePromptId = ref<number | null>(null)
const generating = ref(false)

const { data: characterPrompts } = await useFetch<
  Array<{ id: number; name: string; content: string }>
>('/api/prompts/character-generation', { default: () => [] })

const promptOptions = computed(() => [
  { label: '默认提示词', value: null },
  ...(characterPrompts.value || []).map(p => ({ label: p.name, value: p.id }))
])

function openGenerateDialog() {
  generateCount.value = 3
  generatePromptId.value = null
  showGenerateDialog.value = true
}

async function generateCharacters() {
  generating.value = true
  try {
    const result = await $fetch<{ generated: number }>(
      `/api/novels/${novelId.value}/characters/generate`,
      {
        method: 'POST',
        body: {
          count: generateCount.value,
          promptTemplateId: generatePromptId.value || undefined
        }
      }
    )
    message.success(`成功生成 ${result.generated} 个角色`)
    showGenerateDialog.value = false
    await refreshCharacters()
  } catch (e: any) {
    message.error(e?.data?.message || 'AI 生成角色失败')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div
    v-if="novel"
    class="mx-auto max-w-[1600px] space-y-4 2xl:px-2"
  >
    <section class="card-surface p-4 lg:p-5">
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
                @click="
                  navigateTo(
                    `/novels/${novel.id}/chapters/${chapters?.[0]?.id || 1}`
                  )
                "
              >
                <template #icon><Icon icon="lucide:pen-tool" /></template>
                继续写作
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
            <div class="rounded-lg bg-(--ui-bg-muted)/55 px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">章节</p>
              <p class="mt-0.5 font-mono text-lg text-(--ui-text-highlighted)">
                {{ chapters?.length || 0 }}
              </p>
            </div>
            <div class="rounded-lg bg-(--ui-bg-muted)/55 px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">字数</p>
              <p class="mt-0.5 font-mono text-lg text-(--ui-text-highlighted)">
                {{ totalWords.toLocaleString() }}
              </p>
            </div>
            <div class="rounded-lg bg-(--ui-bg-muted)/55 px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">角色</p>
              <p class="mt-0.5 font-mono text-lg text-(--ui-text-highlighted)">
                {{ sortedCharacters.length }}
              </p>
            </div>
            <div class="rounded-lg bg-(--ui-bg-muted)/55 px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">出场</p>
              <p class="mt-0.5 font-mono text-lg text-(--ui-text-highlighted)">
                {{ characterChapterCount }}
              </p>
            </div>
            <div class="rounded-lg bg-(--ui-bg-muted)/55 px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">状态</p>
              <p class="mt-1 truncate text-sm text-(--ui-text-highlighted)">
                {{ statusLabel }}
              </p>
            </div>
            <div class="rounded-lg bg-(--ui-bg-muted)/55 px-3 py-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">更新</p>
              <p class="mt-1 truncate text-sm text-(--ui-text-highlighted)">
                {{ formatDate(novel.updatedAt) }}
              </p>
            </div>
          </div>
        </div>

        <aside
          class="rounded-lg border border-(--ui-border)/55 bg-(--ui-bg-muted)/35 p-3.5"
        >
          <div class="mb-3 flex items-center gap-2">
            <Icon
              icon="lucide:sparkles"
              class="size-4 text-primary-500"
            />
            <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
              AI 设定
            </h2>
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
          class="rounded-lg bg-(--ui-bg-muted)/40 p-3"
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
          class="rounded-lg bg-(--ui-bg-muted)/40 p-3"
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

    <div
      class="grid gap-4 xl:grid-cols-[minmax(520px,0.92fr)_minmax(640px,1.08fr)]"
    >
      <!-- Chapters -->
      <section class="card-surface p-5">
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
            <NButton
              size="tiny"
              type="primary"
              @click="
                navigateTo(
                  `/novels/${novel.id}/chapters/${chapters?.[0]?.id || 1}`
                )
              "
            >
              <template #icon><Icon icon="lucide:plus" /></template>
              新建章节
            </NButton>
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
        <div
          v-else
          class="space-y-2"
        >
          <NuxtLink
            v-for="chapter in filteredChapters"
            :key="chapter.id"
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
        </div>
      </section>

      <section
        class="card-surface flex min-h-[620px] flex-col overflow-hidden p-4 lg:p-5"
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
            <div class="flex gap-2">
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

          <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_auto]">
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
            class="flex min-h-[250px] flex-col rounded-lg border border-(--ui-border)/55 bg-(--ui-bg-muted)/25 p-3 transition-colors hover:bg-(--ui-bg-muted)/40"
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
              v-if="character.appearances.length"
              class="mt-auto border-t border-(--ui-border)/40 pt-2.5"
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
                      class="shrink-0 rounded bg-(--ui-bg-muted) px-1.5 py-0.5 text-[10px] text-(--ui-text-dimmed)"
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
      </section>
    </div>

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
        <NFormItem label="当前状态">
          <NInput
            v-model:value="characterForm.currentState"
            placeholder="当前位置、处境、心理状态"
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
        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="首次出现章节">
            <NInputNumber
              v-model:value="characterForm.firstAppearanceChapter"
              :min="1"
              clearable
              class="w-full"
            />
          </NFormItem>
          <NFormItem label="最近出现章节">
            <NInputNumber
              v-model:value="characterForm.lastAppearanceChapter"
              :min="1"
              clearable
              class="w-full"
            />
          </NFormItem>
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

    <!-- AI Generate Characters Dialog -->
    <NModal
      v-model:show="showGenerateDialog"
      preset="card"
      title="AI 生成角色"
      class="max-w-md"
    >
      <div class="space-y-4">
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
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showGenerateDialog = false">取消</NButton>
          <NButton
            type="primary"
            :loading="generating"
            @click="generateCharacters"
          >
            <template #icon><Icon icon="lucide:sparkles" /></template>
            开始生成
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

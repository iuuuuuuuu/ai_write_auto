<script setup lang="ts">
import NovelChapterEditor from '~/components/novel/NovelChapterEditor.vue'
import NovelQuickActions from '~/components/novel/NovelQuickActions.vue'
import NovelResourceTabs from '~/components/novel/NovelResourceTabs.vue'

definePageMeta({ layout: 'default' })

type NovelPanelTab = 'chapters' | 'characters' | 'outline'

interface NovelDetail {
  id: number
  title: string
  description: string | null
}

interface ChapterItem {
  id: number
  chapterNumber: number
  title: string
  content: string | null
  summary: string | null
  status: 'draft' | 'generated' | 'edited' | 'final'
  wordCount: number | null
  updatedAt: string | Date
}

interface CharacterItem {
  id: number
  name: string
  description: string | null
  traits: string | null
  relationships: string | null
  currentState: string | null
}

interface OutlineItem {
  id: number
  chapterNumber: number
  description: string
}

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const isNestedRoute = computed(() => route.path !== `/novels/${novelId.value}`)

const { data: novel } = await useFetch<NovelDetail>(
  `/api/novels/${novelId.value}`,
  { key: `novel-detail-${novelId.value}` }
)
const { data: chapters, refresh: refreshChapters } = await useFetch<
  ChapterItem[]
>(`/api/novels/${novelId.value}/chapters`, {
  key: `novel-detail-${novelId.value}-chapters`,
  default: () => []
})
const { data: characters, refresh: refreshCharacters } = await useFetch<
  CharacterItem[]
>(`/api/novels/${novelId.value}/characters`, {
  key: `novel-detail-${novelId.value}-characters`,
  default: () => []
})
const { data: outlines } = await useFetch<OutlineItem[]>(
  `/api/novels/${novelId.value}/outlines`,
  {
    key: `novel-detail-${novelId.value}-outlines`,
    default: () => []
  }
)

const activeTab = shallowRef<NovelPanelTab>('chapters')
const selectedChapterId = shallowRef<number | null>(null)
const showCreateChapter = shallowRef(false)
const showCreateCharacter = shallowRef(false)
const newChapterTitle = shallowRef('')
const newCharacter = reactive({
  name: '',
  description: '',
  traits: '',
  relationships: '',
  currentState: ''
})
const creating = shallowRef(false)
const creatingCharacter = shallowRef(false)
const savingContent = shallowRef(false)
const showGenerateDialog = shallowRef(false)
const generateDirection = shallowRef('')
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

const generationModelOptions = computed(() =>
  aiConfigs.value
    .filter((config) => config.purpose === 'generation' && config.enabled)
    .map((config) => ({
      label: config.isDefault ? `${config.name} · 默认` : config.name,
      value: config.id,
      description: config.model
    }))
)

const selectedAiConfigId = ref<number | undefined>()

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
      selectedAiConfigId.value = options[0].value
    }
  },
  { immediate: true }
)

const selectedChapter = computed(() => {
  if (!chapters.value.length) return null
  return (
    chapters.value.find((chapter) => chapter.id === selectedChapterId.value) ||
    chapters.value[0] ||
    null
  )
})

const readTo = computed(() => `/novels/${novelId.value}/read`)

const chapterCharacters = computed(() => {
  const chapter = selectedChapter.value
  if (!chapter || !chapter.content) return []
  return (characters.value || []).filter((char) =>
    chapter.content!.includes(char.name)
  )
})

const hasDuplicateCharacterName = computed(() => {
  const name = newCharacter.name.trim()
  if (!name) return false
  return (characters.value || []).some(
    (char) => char.name.toLowerCase() === name.toLowerCase()
  )
})

watch(
  chapters,
  (chapterList) => {
    if (!chapterList.length) {
      selectedChapterId.value = null
      return
    }

    if (
      !chapterList.some((chapter) => chapter.id === selectedChapterId.value)
    ) {
      selectedChapterId.value = chapterList[0].id
    }
  },
  { immediate: true }
)

async function createChapter() {
  const title = newChapterTitle.value.trim()
  if (!title) {
    toast.add({ title: '请输入章节标题', color: 'warning' })
    return
  }

  creating.value = true
  try {
    const createdChapter = await $fetch<ChapterItem>(
      `/api/novels/${novelId.value}/chapters`,
      {
        method: 'POST',
        body: { title }
      }
    )
    toast.add({ title: '章节已创建', color: 'success' })
    newChapterTitle.value = ''
    showCreateChapter.value = false
    await refreshChapters()
    selectedChapterId.value = createdChapter.id
    activeTab.value = 'chapters'
  } catch {
    toast.add({ title: '创建章节失败', color: 'error' })
  } finally {
    creating.value = false
  }
}

function resetNewCharacter() {
  newCharacter.name = ''
  newCharacter.description = ''
  newCharacter.traits = ''
  newCharacter.relationships = ''
  newCharacter.currentState = ''
}

async function saveChapterContent(chapterContent: string) {
  if (!selectedChapter.value) return
  savingContent.value = true
  try {
    await $fetch(
      `/api/novels/${novelId.value}/chapters/${selectedChapter.value.id}`,
      {
        method: 'PUT',
        body: { content: chapterContent }
      }
    )
    await refreshChapters()
    toast.add({ title: '已保存', color: 'success' })
  } catch {
    toast.add({ title: '保存失败', color: 'error' })
  } finally {
    savingContent.value = false
  }
}

async function createCharacter() {
  if (!newCharacter.name.trim()) {
    toast.add({ title: '请输入角色名称', color: 'warning' })
    return
  }
  if (hasDuplicateCharacterName.value) {
    toast.add({ title: '该角色名称已存在', color: 'warning' })
    return
  }

  creatingCharacter.value = true
  try {
    await $fetch(`/api/novels/${novelId.value}/characters`, {
      method: 'POST',
      body: {
        name: newCharacter.name.trim(),
        description: newCharacter.description.trim() || undefined,
        traits: newCharacter.traits.trim() || undefined,
        relationships: newCharacter.relationships.trim() || undefined,
        currentState: newCharacter.currentState.trim() || undefined
      }
    })
    toast.add({ title: '角色已创建', color: 'success' })
    resetNewCharacter()
    showCreateCharacter.value = false
    await refreshCharacters()
    activeTab.value = 'characters'
  } catch {
    toast.add({ title: '创建角色失败', color: 'error' })
  } finally {
    creatingCharacter.value = false
  }
}

async function generateChapter() {
  if (!selectedAiConfigId.value || !selectedChapter.value) return
  try {
    await $fetch('/api/ai/generate', {
      method: 'POST',
      body: {
        novelId: novelId.value,
        chapterId: selectedChapter.value.id,
        direction: generateDirection.value || undefined,
        aiConfigId: selectedAiConfigId.value
      }
    })
    toast.add({ title: '生成完成', color: 'success' })
    showGenerateDialog.value = false
    generateDirection.value = ''
    await refreshChapters()
  } catch {
    toast.add({ title: '生成失败', color: 'error' })
  }
}

async function exportNovel(format: string) {
  const response = await fetch(
    `/api/novels/${novelId.value}/export?format=${format}`
  )
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  const extMap: Record<string, string> = { txt: 'txt', md: 'md', epub: 'epub' }
  anchor.download = `${novel.value?.title || 'novel'}.${extMap[format] || format}`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div v-if="isNestedRoute">
    <NuxtPage />
  </div>
  <div
    v-else
    class="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-[1680px] flex-col gap-4 px-4 pb-4 pt-5 sm:px-6 lg:px-8"
  >
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-3">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        size="sm"
        to="/dashboard"
        class="shrink-0"
      />
      <div class="min-w-0 flex-1">
        <h1
          class="truncate text-xl font-semibold tracking-tight text-(--ui-text-highlighted)"
        >
          {{ novel?.title }}
        </h1>
        <p
          v-if="novel?.description"
          class="mt-0.5 truncate text-sm text-(--ui-text-dimmed)"
        >
          {{ novel.description }}
        </p>
      </div>
    </div>

    <!-- Three-column layout -->
    <div
      class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)_280px]"
    >
      <NovelResourceTabs
        v-model:active-tab="activeTab"
        v-model:selected-chapter-id="selectedChapterId"
        :chapters="chapters"
        :characters="characters"
        :outlines="outlines"
        class="h-full"
        @create-chapter="showCreateChapter = true"
        @create-character="showCreateCharacter = true"
      />

      <NovelChapterEditor
        :chapter="selectedChapter"
        class="h-full"
        @save="saveChapterContent"
        @generate="showGenerateDialog = true"
      />

      <NovelQuickActions
        :read-to="readTo"
        :selected-chapter="selectedChapter"
        :chapter-characters="chapterCharacters"
        :chapter-count="chapters.length"
        :character-count="characters.length"
        :outline-count="outlines.length"
        class="h-full overflow-y-auto"
        @create-chapter="showCreateChapter = true"
        @create-character="showCreateCharacter = true"
        @export-novel="exportNovel"
        @generate="showGenerateDialog = true"
        @expand="showGenerateDialog = true"
      />
    </div>

    <UModal v-model:open="showCreateChapter">
      <template #content>
        <div class="space-y-5 p-6">
          <h3 class="text-lg font-semibold text-(--ui-text-highlighted)">
            {{ t('chapter.create') }}
          </h3>
          <UFormField
            :label="t('chapter.title')"
            required
          >
            <UInput
              v-model="newChapterTitle"
              :placeholder="t('chapter.title')"
              size="lg"
              autofocus
              @keyup.enter="createChapter"
            />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showCreateChapter = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :loading="creating"
              @click="createChapter"
            >
              {{ t('common.create') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showCreateCharacter">
      <template #content>
        <div class="space-y-5 p-6">
          <h3 class="text-lg font-semibold text-(--ui-text-highlighted)">
            新建角色
          </h3>
          <div class="space-y-4">
            <UFormField
              label="角色名称"
              required
              :error="
                hasDuplicateCharacterName ? '该角色名称已存在' : undefined
              "
            >
              <UInput
                v-model="newCharacter.name"
                placeholder="例如：林晚舟"
                size="lg"
                autofocus
                @keyup.enter="createCharacter"
              />
            </UFormField>
            <UFormField label="角色简介">
              <UTextarea
                v-model="newCharacter.description"
                placeholder="身份、背景或人物定位"
                :rows="3"
              />
            </UFormField>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UFormField label="性格特征">
                <UInput
                  v-model="newCharacter.traits"
                  placeholder="冷静、敏锐、慢热"
                />
              </UFormField>
              <UFormField label="当前状态">
                <UInput
                  v-model="newCharacter.currentState"
                  placeholder="正在调查主线事件"
                />
              </UFormField>
            </div>
            <UFormField label="人物关系">
              <UTextarea
                v-model="newCharacter.relationships"
                placeholder="与其他角色的关系、冲突或羁绊"
                :rows="3"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showCreateCharacter = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :loading="creatingCharacter"
              :disabled="hasDuplicateCharacterName"
              @click="createCharacter"
            >
              {{ t('common.create') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Generate Dialog -->
    <UModal v-model:open="showGenerateDialog">
      <template #content>
        <div class="space-y-4 p-6">
          <h3 class="text-lg font-semibold text-(--ui-text-highlighted)">
            AI 生成章节
          </h3>
          <UFormField label="生成方向（可选）">
            <UTextarea
              v-model="generateDirection"
              placeholder="描述你希望 AI 如何生成这章内容..."
              :rows="3"
            />
          </UFormField>
          <UFormField
            label="生成模型"
            required
          >
            <USelectMenu
              v-model="selectedAiConfigId"
              :items="generationModelOptions"
              value-key="value"
              placeholder="选择用于生成的模型"
            />
          </UFormField>
          <UAlert
            v-if="!generationModelOptions.length"
            color="warning"
            variant="soft"
            icon="i-lucide-circle-alert"
            title="还没有可用的内容生成模型"
            description="请先到设置页创建并启用一个内容生成模型。"
          />
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              @click="showGenerateDialog = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              icon="i-lucide-sparkles"
              :disabled="!selectedAiConfigId || !selectedChapter"
              @click="generateChapter"
            >
              生成
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

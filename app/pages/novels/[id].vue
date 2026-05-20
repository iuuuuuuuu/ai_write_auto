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
  aiConfigId: number | null
  aiConfigName: string | null
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
const message = useMessage()
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
      selectedAiConfigId.value = options[0]?.value
    }
  },
  { immediate: true }
)

const showNovelSettings = shallowRef(false)
const novelAiConfigId = ref<number | null>(novel.value?.aiConfigId || null)
const savingNovelSettings = shallowRef(false)

const aiConfigOptions = computed(() => [
  { label: '使用默认配置', value: null as any },
  ...aiConfigs.value
    .filter(c => c.enabled)
    .map(c => ({ label: `${c.name} (${c.model})`, value: c.id }))
])

async function saveNovelAiConfig() {
  savingNovelSettings.value = true
  try {
    await $fetch(`/api/novels/${novelId.value}`, {
      method: 'PUT',
      body: { aiConfigId: novelAiConfigId.value }
    })
    if (novel.value) {
      novel.value.aiConfigId = novelAiConfigId.value
      novel.value.aiConfigName = aiConfigs.value.find(c => c.id === novelAiConfigId.value)?.name || null
    }
    message.success('模型配置已更新')
    showNovelSettings.value = false
  } catch {
    message.error('更新失败')
  } finally {
    savingNovelSettings.value = false
  }
}

const selectedChapter = computed(() => {
  if (!chapters.value.length) return null
  return (
    chapters.value.find((chapter) => chapter.id === selectedChapterId.value) ||
    chapters.value[0] ||
    null
  )
})

const readTo = computed(() => `/novels/${novelId.value}/read`)

const chapterCharacters = ref<CharacterItem[]>([])

async function refreshChapterCharacters() {
  if (!selectedChapter.value) {
    chapterCharacters.value = []
    return
  }
  try {
    const data = await $fetch<Array<{ characterId: number; characterName: string; characterDescription: string | null; role: string }>>(
      `/api/novels/${novelId.value}/chapters/${selectedChapter.value.id}/characters`
    )
    chapterCharacters.value = data.map(d => ({
      id: d.characterId,
      name: d.characterName,
      description: d.characterDescription,
      traits: null,
      relationships: null,
      currentState: null,
    }))
  } catch {
    // Fallback to name-based detection
    const chapter = selectedChapter.value
    if (chapter?.content) {
      chapterCharacters.value = (characters.value || []).filter(char =>
        chapter.content!.includes(char.name)
      )
    } else {
      chapterCharacters.value = []
    }
  }
}

watch(() => selectedChapter.value?.id, () => {
  refreshChapterCharacters()
}, { immediate: true })

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
      selectedChapterId.value = chapterList[0]?.id ?? null
    }
  },
  { immediate: true }
)

async function createChapter() {
  const title = newChapterTitle.value.trim()
  if (!title) {
    message.warning('请输入章节标题')
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
    message.success('章节已创建')
    newChapterTitle.value = ''
    showCreateChapter.value = false
    await refreshChapters()
    selectedChapterId.value = createdChapter.id
    activeTab.value = 'chapters'
  } catch {
    message.error('创建章节失败')
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
    message.success('已保存')
  } catch {
    message.error('保存失败')
  } finally {
    savingContent.value = false
  }
}

async function createCharacter() {
  if (!newCharacter.name.trim()) {
    message.warning('请输入角色名称')
    return
  }
  if (hasDuplicateCharacterName.value) {
    message.warning('该角色名称已存在')
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
    message.success('角色已创建')
    resetNewCharacter()
    showCreateCharacter.value = false
    await refreshCharacters()
    activeTab.value = 'characters'
  } catch {
    message.error('创建角色失败')
  } finally {
    creatingCharacter.value = false
  }
}

const showEditCharacter = shallowRef(false)
const editingCharacter = reactive({
  id: 0,
  name: '',
  description: '',
  traits: '',
  relationships: '',
  currentState: ''
})
const savingCharacter = shallowRef(false)

function startEditCharacter(character: CharacterItem) {
  editingCharacter.id = character.id
  editingCharacter.name = character.name
  editingCharacter.description = character.description || ''
  editingCharacter.traits = character.traits || ''
  editingCharacter.relationships = character.relationships || ''
  editingCharacter.currentState = character.currentState || ''
  showEditCharacter.value = true
}

async function saveEditCharacter() {
  if (!editingCharacter.name.trim()) {
    message.warning('请输入角色名称')
    return
  }
  savingCharacter.value = true
  try {
    await $fetch(`/api/novels/${novelId.value}/characters/${editingCharacter.id}`, {
      method: 'PUT',
      body: {
        name: editingCharacter.name.trim(),
        description: editingCharacter.description.trim() || undefined,
        traits: editingCharacter.traits.trim() || undefined,
        relationships: editingCharacter.relationships.trim() || undefined,
        currentState: editingCharacter.currentState.trim() || undefined
      }
    })
    message.success('角色已更新')
    showEditCharacter.value = false
    await refreshCharacters()
  } catch {
    message.error('更新角色失败')
  } finally {
    savingCharacter.value = false
  }
}

async function deleteCharacter(characterId: number) {
  try {
    await $fetch(`/api/novels/${novelId.value}/characters/${characterId}`, {
      method: 'DELETE'
    })
    message.success('角色已删除')
    await refreshCharacters()
  } catch {
    message.error('删除角色失败')
  }
}

async function assignCharacterToChapter(characterId: number) {
  if (!selectedChapter.value) return
  const current = chapterCharacters.value.map(c => ({ characterId: c.id, role: 'supporting' as const }))
  current.push({ characterId, role: 'supporting' })
  try {
    await $fetch(`/api/novels/${novelId.value}/chapters/${selectedChapter.value.id}/characters`, {
      method: 'PUT',
      body: { characters: current }
    })
    await refreshChapterCharacters()
  } catch {
    message.error('分配角色失败')
  }
}

async function unassignCharacterFromChapter(characterId: number) {
  if (!selectedChapter.value) return
  const current = chapterCharacters.value
    .filter(c => c.id !== characterId)
    .map(c => ({ characterId: c.id, role: 'supporting' as const }))
  try {
    await $fetch(`/api/novels/${novelId.value}/chapters/${selectedChapter.value.id}/characters`, {
      method: 'PUT',
      body: { characters: current }
    })
    await refreshChapterCharacters()
  } catch {
    message.error('取消分配失败')
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
    message.success('生成完成')
    showGenerateDialog.value = false
    generateDirection.value = ''
    await refreshChapters()
  } catch {
    message.error('生成失败')
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
    class="flex h-[calc(100dvh-3rem)] flex-col gap-3 px-3 pb-3 pt-3 lg:px-4"
  >
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-2.5">
      <button
        class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
        @click="navigateTo('/dashboard')"
      >
        <Icon icon="lucide:arrow-left" class="w-4 h-4" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-base font-semibold text-(--ui-text-highlighted)">
          {{ novel?.title }}
        </h1>
      </div>
      <button
        class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
        @click="showNovelSettings = true"
      >
        <Icon icon="lucide:settings" class="w-3.5 h-3.5" />
      </button>
      <NuxtLink
        :to="`/novels/${novelId}/chapters/${selectedChapter?.id}`"
        v-if="selectedChapter"
        class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
      >
        <Icon icon="lucide:maximize-2" class="w-3.5 h-3.5" />
      </NuxtLink>
    </div>

    <!-- Three-column layout -->
    <div
      class="grid min-h-0 flex-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)_260px]"
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
        @edit-character="startEditCharacter"
        @delete-character="deleteCharacter"
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
        :all-characters="characters"
        :chapter-count="chapters.length"
        :character-count="characters.length"
        :outline-count="outlines.length"
        class="h-full overflow-y-auto"
        @create-chapter="showCreateChapter = true"
        @create-character="showCreateCharacter = true"
        @export-novel="exportNovel"
        @generate="showGenerateDialog = true"
        @expand="showGenerateDialog = true"
        @assign-character="assignCharacterToChapter"
        @unassign-character="unassignCharacterFromChapter"
      />
    </div>

    <!-- Create Chapter Modal -->
    <NModal v-model:show="showCreateChapter" preset="card" :title="t('chapter.create')" style="max-width: 480px;">
      <NFormItem :label="t('chapter.title')" required>
        <NInput
          v-model:value="newChapterTitle"
          :placeholder="t('chapter.title')"
          size="large"
          autofocus
          @keyup.enter="createChapter"
        />
      </NFormItem>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCreateChapter = false">
            {{ t('common.cancel') }}
          </NButton>
          <NButton
            type="primary"
            :loading="creating"
            @click="createChapter"
          >
            {{ t('common.create') }}
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- Create Character Modal -->
    <NModal v-model:show="showCreateCharacter" preset="card" title="新建角色" style="max-width: 560px;">
      <div class="space-y-4">
        <NFormItem
          label="角色名称"
          required
          :validation-status="hasDuplicateCharacterName ? 'error' : undefined"
          :feedback="hasDuplicateCharacterName ? '该角色名称已存在' : undefined"
        >
          <NInput
            v-model:value="newCharacter.name"
            placeholder="例如：林晚舟"
            size="large"
            autofocus
            @keyup.enter="createCharacter"
          />
        </NFormItem>
        <NFormItem label="角色简介">
          <NInput
            v-model:value="newCharacter.description"
            type="textarea"
            placeholder="身份、背景或人物定位"
            :rows="3"
          />
        </NFormItem>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NFormItem label="性格特征">
            <NInput
              v-model:value="newCharacter.traits"
              placeholder="冷静、敏锐、慢热"
            />
          </NFormItem>
          <NFormItem label="当前状态">
            <NInput
              v-model:value="newCharacter.currentState"
              placeholder="正在调查主线事件"
            />
          </NFormItem>
        </div>
        <NFormItem label="人物关系">
          <NInput
            v-model:value="newCharacter.relationships"
            type="textarea"
            placeholder="与其他角色的关系、冲突或羁绊"
            :rows="3"
          />
        </NFormItem>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCreateCharacter = false">
            {{ t('common.cancel') }}
          </NButton>
          <NButton
            type="primary"
            :loading="creatingCharacter"
            :disabled="hasDuplicateCharacterName"
            @click="createCharacter"
          >
            {{ t('common.create') }}
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- Generate Dialog -->
    <NModal v-model:show="showGenerateDialog" preset="card" title="AI 生成章节" style="max-width: 500px;">
      <div class="space-y-4">
        <NFormItem label="生成方向（可选）">
          <NInput
            v-model:value="generateDirection"
            type="textarea"
            placeholder="描述你希望 AI 如何生成这章内容..."
            :rows="3"
          />
        </NFormItem>
        <NFormItem label="生成模型" required>
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
          <NButton @click="showGenerateDialog = false">
            {{ t('common.cancel') }}
          </NButton>
          <NButton
            type="primary"
            :disabled="!selectedAiConfigId || !selectedChapter"
            @click="generateChapter"
          >
            <template #icon>
              <Icon icon="lucide:sparkles" />
            </template>
            生成
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- Edit Character Modal -->
    <NModal v-model:show="showEditCharacter" preset="card" title="编辑角色" style="max-width: 560px;">
      <div class="space-y-4">
        <NFormItem label="角色名称" required>
          <NInput v-model:value="editingCharacter.name" placeholder="角色名称" size="large" />
        </NFormItem>
        <NFormItem label="角色简介">
          <NInput v-model:value="editingCharacter.description" type="textarea" placeholder="身份、背景或人物定位" :rows="3" />
        </NFormItem>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NFormItem label="性格特征">
            <NInput v-model:value="editingCharacter.traits" placeholder="冷静、敏锐、慢热" />
          </NFormItem>
          <NFormItem label="当前状态">
            <NInput v-model:value="editingCharacter.currentState" placeholder="正在调查主线事件" />
          </NFormItem>
        </div>
        <NFormItem label="人物关系">
          <NInput v-model:value="editingCharacter.relationships" type="textarea" placeholder="与其他角色的关系" :rows="3" />
        </NFormItem>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showEditCharacter = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingCharacter" @click="saveEditCharacter">保存</NButton>
        </div>
      </template>
    </NModal>

    <!-- Novel Settings Modal -->
    <NModal v-model:show="showNovelSettings" preset="card" title="小说设置" style="max-width: 480px;">
      <div class="space-y-4">
        <div>
          <p class="text-sm font-medium text-(--ui-text) mb-1.5">AI 模型配置</p>
          <p class="text-xs text-(--ui-text-dimmed) mb-3">为这本小说选择独立的模型配置，或使用你的默认配置</p>
          <NSelect
            v-model:value="novelAiConfigId"
            :options="aiConfigOptions"
            placeholder="使用默认配置"
            clearable
          />
        </div>
        <div v-if="novel?.aiConfigName" class="text-xs text-(--ui-text-dimmed)">
          当前使用：<span class="font-medium text-(--ui-text)">{{ novel.aiConfigName }}</span>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showNovelSettings = false">取消</NButton>
          <NButton type="primary" :loading="savingNovelSettings" @click="saveNovelAiConfig">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

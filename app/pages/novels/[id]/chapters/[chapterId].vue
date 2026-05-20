<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const chapterId = computed(() => Number(route.params.chapterId))

function getNovelTo() {
  return {
    path: `/novels/${novelId.value}`
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
}>(`/api/novels/${novelId.value}/chapters/${chapterId.value}`)
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

const content = ref(chapter.value?.content || '')
const saving = ref(false)
const lastSaved = ref<Date | null>(null)
const generating = ref(false)
const generatedContent = ref('')
const showGenerateDialog = ref(false)
const generateDirection = ref('')
const selectedAiConfigId = ref<number | undefined>()
const zenMode = ref(false)
const conflictDetected = ref(false)
const serverUpdatedAt = ref(chapter.value?.updatedAt || null)

const showFloatingToolbar = ref(false)
const floatingToolbarPos = reactive({ x: 0, y: 0 })
const selectedText = ref('')
const expandingOrRewriting = ref(false)
const aiActionResult = ref('')
const aiActionType = ref<'expand' | 'rewrite' | null>(null)

const generationModelOptions = computed(() =>
  aiConfigs.value
    .filter((config) => config.purpose === 'generation' && config.enabled)
    .map((config) => ({
      label: config.isDefault ? `${config.name} · 默认` : config.name,
      value: config.id,
      description: config.model
    }))
)

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

async function saveContent() {
  saving.value = true
  try {
    const result = await $fetch(
      `/api/novels/${novelId.value}/chapters/${chapterId.value}`,
      {
        method: 'PUT',
        body: {
          content: content.value,
          expectedUpdatedAt: serverUpdatedAt.value || undefined
        }
      }
    )
    lastSaved.value = new Date()
    serverUpdatedAt.value =
      (result as any)?.updatedAt || lastSaved.value.toISOString()
    conflictDetected.value = false
  } catch (e: any) {
    if (e?.statusCode === 409) {
      conflictDetected.value = true
    }
  } finally {
    saving.value = false
  }
}

function handleTextSelect(e: Event) {
  const textarea = e.target as HTMLTextAreaElement
  const selected = textarea.value.substring(
    textarea.selectionStart,
    textarea.selectionEnd
  )
  if (selected.trim().length > 0) {
    selectedText.value = selected
    const rect = textarea.getBoundingClientRect()
    floatingToolbarPos.x = rect.left + rect.width / 2
    floatingToolbarPos.y = rect.top - 10
    showFloatingToolbar.value = true
  } else {
    showFloatingToolbar.value = false
  }
}

async function doAiAction(type: 'expand' | 'rewrite') {
  showFloatingToolbar.value = false
  expandingOrRewriting.value = true
  aiActionResult.value = ''
  aiActionType.value = type

  try {
    const response = await fetch(`/api/ai/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: novelId.value,
        chapterId: chapterId.value,
        selectedText: selectedText.value,
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
          if (data.content) aiActionResult.value += data.content
          if (data.done) break
        } catch {}
      }
    }
  } finally {
    expandingOrRewriting.value = false
  }
}

function applyAiResult() {
  if (aiActionResult.value && selectedText.value) {
    content.value = content.value.replace(
      selectedText.value,
      aiActionResult.value
    )
    aiActionResult.value = ''
    aiActionType.value = null
    saveContent()
  }
}

function discardAiResult() {
  aiActionResult.value = ''
  aiActionType.value = null
}

async function loadLatestChapter() {
  await refreshChapter()
  content.value = chapter.value?.content || ''
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
            content.value = generatedContent.value
            await saveContent()
            await refreshChapter()
          }
        } catch {}
      }
    }
  } finally {
    generating.value = false
  }
}

onBeforeUnmount(() => {
  if (saveTimeout) clearTimeout(saveTimeout)
})
</script>

<template>
  <div
    class="h-screen flex flex-col bg-(--ui-bg)"
    :class="{ 'fixed inset-0 z-50': zenMode }"
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
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-(--ui-text-highlighted) truncate">
          {{ chapter?.title }}
        </p>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] tabular-nums text-(--ui-text-dimmed)">
          {{ content.replace(/\s/g, '').length }} {{ t('chapter.wordCount') }}
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
          @click="zenMode = true"
        >
          <Icon
            icon="lucide:maximize"
            class="w-3.5 h-3.5"
          />
        </button>
        <NButton
          size="tiny"
          quaternary
          :loading="generating"
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

    <!-- Editor Area -->
    <div class="flex-1 overflow-hidden flex">
      <div class="flex-1 overflow-y-auto px-6 py-6">
        <div class="max-w-3xl mx-auto">
          <textarea
            v-model="content"
            class="w-full min-h-[calc(100vh-160px)] bg-transparent text-(--ui-text) text-[15px] leading-[2] resize-none outline-none placeholder:text-(--ui-text-dimmed)/40"
            :class="zenMode ? 'text-base leading-[2.2]' : ''"
            :placeholder="t('chapter.content') + '...'"
            @keydown.ctrl.s.prevent="saveContent"
            @keydown.ctrl.shift.z.prevent="zenMode = !zenMode"
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
                  aiActionType === 'expand' ?
                    t('chapter.expand')
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
          <div
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
      </div>
    </Teleport>

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
            :disabled="!selectedAiConfigId"
            @click="generateChapter"
          >
            <template #icon><Icon icon="lucide:sparkles" /></template>
            {{ t('chapter.generate') }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

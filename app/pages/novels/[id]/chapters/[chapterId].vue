<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const chapterId = computed(() => Number(route.params.chapterId))

const { data: chapter, refresh: refreshChapter } = await useFetch(
  `/api/novels/${novelId.value}/chapters/${chapterId.value}`
)

const content = ref(chapter.value?.content || '')
const saving = ref(false)
const lastSaved = ref<Date | null>(null)
const generating = ref(false)
const generatedContent = ref('')
const showGenerateDialog = ref(false)
const generateDirection = ref('')
const zenMode = ref(false)
const conflictDetected = ref(false)
const serverUpdatedAt = ref(chapter.value?.updatedAt || null)

// Floating toolbar state
const showFloatingToolbar = ref(false)
const floatingToolbarPos = reactive({ x: 0, y: 0 })
const selectedText = ref('')
const expandingOrRewriting = ref(false)
const aiActionResult = ref('')
const aiActionType = ref<'expand' | 'rewrite' | null>(null)

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
    const result = await $fetch(`/api/novels/${novelId.value}/chapters/${chapterId.value}`, {
      method: 'PUT',
      body: {
        content: content.value,
        expectedUpdatedAt: serverUpdatedAt.value || undefined,
      },
    })
    lastSaved.value = new Date()
    serverUpdatedAt.value = (result as any)?.updatedAt || lastSaved.value.toISOString()
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
  const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
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
      }),
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
    content.value = content.value.replace(selectedText.value, aiActionResult.value)
    aiActionResult.value = ''
    aiActionType.value = null
    saveContent()
  }
}

function discardAiResult() {
  aiActionResult.value = ''
  aiActionType.value = null
}

async function generateChapter() {
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
      }),
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
  <div class="h-screen flex flex-col" :class="{ 'fixed inset-0 z-50 bg-white dark:bg-gray-950': zenMode }">
    <!-- Toolbar -->
    <div v-if="!zenMode" class="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <UButton variant="ghost" icon="i-lucide-arrow-left" size="sm" :to="`/novels/${novelId}`" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {{ chapter?.title }}
        </p>
        <p class="text-xs text-gray-400">
          <span v-if="saving">{{ t('common.loading') }}</span>
          <span v-else-if="lastSaved">{{ t('chapter.autoSaved') }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">
          {{ content.replace(/\s/g, '').length }} {{ t('chapter.wordCount') }}
        </span>
        <UButton size="sm" variant="ghost" icon="i-lucide-maximize" @click="zenMode = true" />
        <UButton size="sm" variant="soft" icon="i-lucide-sparkles" :loading="generating" @click="showGenerateDialog = true">
          {{ t('chapter.generate') }}
        </UButton>
        <UButton size="sm" :loading="saving" @click="saveContent">
          {{ t('common.save') }}
        </UButton>
      </div>
    </div>

    <!-- Zen Mode Exit -->
    <div v-if="zenMode" class="absolute top-4 right-4 z-10 opacity-0 hover:opacity-100 transition-opacity">
      <UButton size="sm" variant="ghost" icon="i-lucide-minimize" @click="zenMode = false" />
    </div>

    <!-- Conflict Warning -->
    <div v-if="conflictDetected" class="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
      <p class="text-sm text-amber-700 dark:text-amber-300">
        此章节已在其他标签页中被修改，保存可能覆盖更改。
      </p>
      <div class="flex gap-2">
        <UButton size="xs" variant="soft" color="warning" @click="refreshChapter().then(() => { content = chapter?.content || ''; conflictDetected = false })">
          加载最新版本
        </UButton>
        <UButton size="xs" variant="ghost" @click="serverUpdatedAt = null; saveContent()">
          强制保存
        </UButton>
      </div>
    </div>

    <!-- Editor Area -->
    <div class="flex-1 overflow-hidden flex">
      <div class="flex-1 overflow-y-auto p-8">
        <div class="max-w-3xl mx-auto">
          <textarea
            v-model="content"
            class="w-full min-h-[calc(100vh-200px)] bg-transparent text-gray-900 dark:text-gray-100 text-base leading-relaxed resize-none outline-none placeholder-gray-300 dark:placeholder-gray-600"
            :class="zenMode ? 'text-lg leading-loose' : ''"
            :placeholder="t('chapter.content') + '...'"
            @keydown.ctrl.s.prevent="saveContent"
            @keydown.ctrl.shift.z.prevent="zenMode = !zenMode"
            @mouseup="handleTextSelect"
          />
        </div>

        <!-- AI Action Result -->
        <div v-if="aiActionResult" class="max-w-3xl mx-auto mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-green-600 dark:text-green-400">
              {{ aiActionType === 'expand' ? t('chapter.expand') : t('chapter.rewrite') }}
            </p>
            <div class="flex gap-1">
              <UButton size="xs" variant="soft" color="success" @click="applyAiResult">应用</UButton>
              <UButton size="xs" variant="ghost" @click="discardAiResult">放弃</UButton>
            </div>
          </div>
          <div class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap text-sm">{{ aiActionResult }}</div>
        </div>

        <!-- Generated Content Preview -->
        <div v-if="generating && generatedContent" class="max-w-3xl mx-auto mt-4 p-4 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <p class="text-xs text-primary-600 dark:text-primary-400 mb-2">{{ t('ai.generating') }}</p>
          <div class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{{ generatedContent }}</div>
        </div>
      </div>
    </div>

    <!-- Floating Toolbar -->
    <Teleport to="body">
      <div
        v-if="showFloatingToolbar && !generating"
        class="fixed z-50 flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
        :style="{ left: `${floatingToolbarPos.x}px`, top: `${floatingToolbarPos.y}px`, transform: 'translate(-50%, -100%)' }"
      >
        <UButton size="xs" variant="ghost" icon="i-lucide-expand" :loading="expandingOrRewriting" @click="doAiAction('expand')">
          {{ t('chapter.expand') }}
        </UButton>
        <UButton size="xs" variant="ghost" icon="i-lucide-refresh-cw" :loading="expandingOrRewriting" @click="doAiAction('rewrite')">
          {{ t('chapter.rewrite') }}
        </UButton>
      </div>
    </Teleport>

    <!-- Generate Dialog -->
    <UModal v-model:open="showGenerateDialog">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('chapter.generateDialog.title') }}
          </h3>
          <UFormField :label="t('chapter.generateDialog.direction')">
            <UTextarea
              v-model="generateDirection"
              :placeholder="t('chapter.generateDialog.directionPlaceholder')"
              :rows="3"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showGenerateDialog = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton icon="i-lucide-sparkles" @click="generateChapter">
              {{ t('chapter.generate') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

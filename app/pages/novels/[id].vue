<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const route = useRoute()
const novelId = computed(() => Number(route.params.id))

const { data: novel, refresh: refreshNovel } = await useFetch(`/api/novels/${novelId.value}`)
const { data: chapters, refresh: refreshChapters } = await useFetch(`/api/novels/${novelId.value}/chapters`)
const { data: characters, refresh: refreshCharacters } = await useFetch(`/api/novels/${novelId.value}/characters`)
const { data: outlines } = await useFetch(`/api/novels/${novelId.value}/outlines`)

const activeTab = ref('chapters')
const showCreateChapter = ref(false)
const newChapterTitle = ref('')
const creating = ref(false)
const showExportMenu = ref(false)

async function createChapter() {
  if (!newChapterTitle.value.trim()) return
  creating.value = true
  try {
    await $fetch(`/api/novels/${novelId.value}/chapters`, {
      method: 'POST',
      body: { title: newChapterTitle.value },
    })
    newChapterTitle.value = ''
    showCreateChapter.value = false
    await refreshChapters()
  } finally {
    creating.value = false
  }
}

async function exportNovel(format: string) {
  const response = await fetch(`/api/novels/${novelId.value}/export?format=${format}`)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${novel.value?.title || 'novel'}.${format === 'md' ? 'md' : 'txt'}`
  a.click()
  URL.revokeObjectURL(url)
  showExportMenu.value = false
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <UButton variant="ghost" icon="i-lucide-arrow-left" to="/dashboard" />
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ novel?.title }}
        </h1>
        <p v-if="novel?.description" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ novel.description }}
        </p>
      </div>
      <UDropdownMenu
        :items="[
          [{ label: '导出 TXT', icon: 'i-lucide-file-text', click: () => exportNovel('txt') }],
          [{ label: '导出 Markdown', icon: 'i-lucide-file-code', click: () => exportNovel('md') }],
        ]"
      >
        <UButton variant="ghost" icon="i-lucide-download" />
      </UDropdownMenu>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
      <button
        v-for="tab in [
          { key: 'chapters', label: t('chapter.title'), icon: 'i-lucide-file-text' },
          { key: 'characters', label: t('chapter.characters'), icon: 'i-lucide-users' },
          { key: 'outline', label: t('chapter.outline'), icon: 'i-lucide-list' },
        ]"
        :key="tab.key"
        class="flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px transition-colors"
        :class="activeTab === tab.key ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
        @click="activeTab = tab.key"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Chapters Tab -->
    <div v-if="activeTab === 'chapters'" class="space-y-4">
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-500">{{ (chapters as any[])?.length || 0 }} 章</p>
        <UButton icon="i-lucide-plus" size="sm" @click="showCreateChapter = true">
          {{ t('chapter.create') }}
        </UButton>
      </div>

      <div v-if="(chapters as any[])?.length" class="space-y-2">
        <NuxtLink
          v-for="chapter in (chapters as any[])"
          :key="chapter.id"
          :to="`/novels/${novelId}/chapters/${chapter.id}`"
          class="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <span class="text-sm font-mono text-gray-400 dark:text-gray-500 w-8 text-center">
            {{ chapter.chapterNumber }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 dark:text-white truncate">{{ chapter.title }}</p>
            <p v-if="chapter.summary" class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ chapter.summary }}</p>
          </div>
          <div class="flex items-center gap-3 text-xs text-gray-400">
            <span>{{ chapter.wordCount || 0 }} 字</span>
            <UBadge :color="chapter.status === 'final' ? 'success' : chapter.status === 'generated' ? 'info' : 'neutral'" variant="subtle" size="xs">
              {{ chapter.status }}
            </UBadge>
          </div>
        </NuxtLink>
      </div>

      <div v-else class="text-center py-12 text-gray-400 dark:text-gray-500">
        <UIcon name="i-lucide-file-text" class="w-8 h-8 mx-auto mb-2" />
        <p>{{ t('common.noData') }}</p>
      </div>
    </div>

    <!-- Characters Tab -->
    <div v-if="activeTab === 'characters'" class="space-y-4">
      <div v-if="(characters as any[])?.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="char in (characters as any[])"
          :key="char.id"
          class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
        >
          <p class="font-medium text-gray-900 dark:text-white">{{ char.name }}</p>
          <p v-if="char.description" class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ char.description }}</p>
          <p v-if="char.traits" class="mt-1 text-xs text-gray-400">性格：{{ char.traits }}</p>
        </div>
      </div>
      <div v-else class="text-center py-12 text-gray-400">
        <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2" />
        <p>暂无角色信息，AI 生成章节后会自动提取</p>
      </div>
    </div>

    <!-- Outline Tab -->
    <div v-if="activeTab === 'outline'" class="space-y-4">
      <div v-if="(outlines as any[])?.length" class="space-y-2">
        <div
          v-for="outline in (outlines as any[])"
          :key="outline.id"
          class="flex gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
        >
          <span class="text-sm font-mono text-gray-400 w-8 text-center shrink-0">{{ outline.chapterNumber }}</span>
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ outline.description }}</p>
        </div>
      </div>
      <div v-else class="text-center py-12 text-gray-400">
        <UIcon name="i-lucide-list" class="w-8 h-8 mx-auto mb-2" />
        <p>暂无大纲，可在设置中使用 AI 生成</p>
      </div>
    </div>

    <!-- Create Chapter Modal -->
    <UModal v-model:open="showCreateChapter">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('chapter.create') }}</h3>
          <UFormField :label="t('chapter.title')">
            <UInput v-model="newChapterTitle" :placeholder="t('chapter.title')" autofocus @keyup.enter="createChapter" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showCreateChapter = false">{{ t('common.cancel') }}</UButton>
            <UButton :loading="creating" @click="createChapter">{{ t('common.create') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

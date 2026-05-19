<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { data: trash, refresh } = await useFetch('/api/novels/trash')
const restoring = ref<number | null>(null)

const deletedNovels = computed(() => (trash.value as any)?.novels || [])
const deletedChapters = computed(() => (trash.value as any)?.chapters || [])

async function restore(type: 'novel' | 'chapter', id: number) {
  restoring.value = id
  try {
    await $fetch('/api/novels/trash', {
      method: 'POST',
      body: { type, id },
    })
    await refresh()
  } finally {
    restoring.value = null
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center gap-4 mb-8">
      <UButton variant="ghost" icon="i-lucide-arrow-left" to="/dashboard" />
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">回收站</h1>
    </div>

    <div v-if="!deletedNovels.length && !deletedChapters.length" class="text-center py-16">
      <div class="text-gray-400 text-4xl mb-4">🗑️</div>
      <p class="text-gray-500 dark:text-gray-400">回收站为空</p>
      <p class="text-sm text-gray-400 mt-1">已删除的小说和章节会在此显示，30天后自动清理</p>
    </div>

    <!-- Deleted Novels -->
    <div v-if="deletedNovels.length" class="mb-8">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">已删除的小说</h2>
      <div class="space-y-3">
        <div
          v-for="novel in deletedNovels"
          :key="novel.id"
          class="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ novel.title }}</p>
            <p class="text-xs text-gray-400 mt-0.5">删除于 {{ formatDate(novel.deletedAt) }}</p>
          </div>
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-undo-2"
            :loading="restoring === novel.id"
            @click="restore('novel', novel.id)"
          >
            恢复
          </UButton>
        </div>
      </div>
    </div>

    <!-- Deleted Chapters -->
    <div v-if="deletedChapters.length">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">已删除的章节</h2>
      <div class="space-y-3">
        <div
          v-for="chapter in deletedChapters"
          :key="chapter.id"
          class="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <div>
            <p class="font-medium text-gray-900 dark:text-white">
              第{{ chapter.chapterNumber }}章 {{ chapter.title }}
            </p>
            <p class="text-xs text-gray-400 mt-0.5">
              {{ chapter.wordCount || 0 }} 字 · 删除于 {{ formatDate(chapter.deletedAt) }}
            </p>
          </div>
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-undo-2"
            :loading="restoring === chapter.id"
            @click="restore('chapter', chapter.id)"
          >
            恢复
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

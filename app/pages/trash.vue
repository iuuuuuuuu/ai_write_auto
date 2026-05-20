<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()

interface TrashNovel {
  id: number
  title: string
  deletedAt: string
}

interface TrashChapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number | null
  deletedAt: string
}

const loading = ref(true)
const novels = ref<TrashNovel[]>([])
const chapters = ref<TrashChapter[]>([])
const novelPage = ref(1)
const chapterPage = ref(1)
const novelTotal = ref(0)
const chapterTotal = ref(0)
const novelTotalPages = ref(0)
const chapterTotalPages = ref(0)
const pageSize = 20
const restoring = ref<number | null>(null)

async function fetchTrash() {
  loading.value = true
  try {
    const data = await $fetch<any>('/api/novels/trash', {
      params: { page: novelPage.value, pageSize },
    })
    novels.value = data.novels?.items || []
    novelTotal.value = data.novels?.total || 0
    novelTotalPages.value = data.novels?.totalPages || 0
    chapters.value = data.chapters?.items || []
    chapterTotal.value = data.chapters?.total || 0
    chapterTotalPages.value = data.chapters?.totalPages || 0
  } finally {
    loading.value = false
  }
}

function goToNovelPage(p: number) {
  novelPage.value = p
  fetchTrash()
}

fetchTrash()

async function restore(type: 'novel' | 'chapter', id: number) {
  restoring.value = id
  try {
    await $fetch('/api/novels/trash', {
      method: 'POST',
      body: { type, id },
    })
    await fetchTrash()
  } finally {
    restoring.value = null
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
    <div class="flex items-center gap-4 mb-5">
      <NButton quaternary @click="navigateTo('/dashboard')">
        <template #icon>
          <Icon icon="lucide:arrow-left" />
        </template>
      </NButton>
      <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">回收站</h1>
    </div>

    <div v-if="loading" class="space-y-3">
      <NSkeleton v-for="i in 4" :key="i" class="h-16 rounded-lg" text />
    </div>

    <div v-else-if="!novels.length && !chapters.length" class="text-center py-16">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--ui-bg-muted) border border-(--ui-border) mb-5">
        <Icon icon="lucide:trash-2" class="w-7 h-7 text-(--ui-text-dimmed)" />
      </div>
      <p class="text-(--ui-text-muted)">回收站为空</p>
      <p class="text-sm text-(--ui-text-dimmed) mt-1">已删除的小说和章节会在此显示，30天后自动清理</p>
    </div>

    <template v-else>
      <!-- Deleted Novels -->
      <div v-if="novels.length" class="mb-6">
        <h2 class="text-sm font-medium text-(--ui-text-dimmed) uppercase tracking-wider mb-3">已删除的小说</h2>
        <div class="space-y-2">
          <div
            v-for="novel in novels"
            :key="novel.id"
            class="flex items-center justify-between p-4 rounded-lg border border-(--ui-border) bg-(--ui-bg-muted)"
          >
            <div>
              <p class="font-medium text-(--ui-text-highlighted)">{{ novel.title }}</p>
              <p class="text-xs text-(--ui-text-dimmed) mt-0.5">删除于 {{ formatDate(novel.deletedAt) }}</p>
            </div>
            <NButton
              size="small"
              secondary
              :loading="restoring === novel.id"
              @click="restore('novel', novel.id)"
            >
              <template #icon>
                <Icon icon="lucide:undo-2" />
              </template>
              恢复
            </NButton>
          </div>
        </div>
        <div v-if="novelTotalPages > 1" class="flex items-center justify-between pt-3">
          <span class="text-xs text-(--ui-text-dimmed)">共 {{ novelTotal }} 部</span>
          <NPagination
            :page="novelPage"
            :page-count="novelTotalPages"
            :page-size="pageSize"
            @update:page="goToNovelPage"
          />
        </div>
      </div>

      <!-- Deleted Chapters -->
      <div v-if="chapters.length">
        <h2 class="text-sm font-medium text-(--ui-text-dimmed) uppercase tracking-wider mb-3">已删除的章节</h2>
        <div class="space-y-2">
          <div
            v-for="chapter in chapters"
            :key="chapter.id"
            class="flex items-center justify-between p-4 rounded-lg border border-(--ui-border) bg-(--ui-bg-muted)"
          >
            <div>
              <p class="font-medium text-(--ui-text-highlighted)">
                第{{ chapter.chapterNumber }}章 {{ chapter.title }}
              </p>
              <p class="text-xs text-(--ui-text-dimmed) mt-0.5">
                {{ chapter.wordCount || 0 }} 字 · 删除于 {{ formatDate(chapter.deletedAt) }}
              </p>
            </div>
            <NButton
              size="small"
              secondary
              :loading="restoring === chapter.id"
              @click="restore('chapter', chapter.id)"
            >
              <template #icon>
                <Icon icon="lucide:undo-2" />
              </template>
              恢复
            </NButton>
          </div>
        </div>
        <div v-if="chapterTotalPages > 1" class="flex items-center justify-between pt-3">
          <span class="text-xs text-(--ui-text-dimmed)">共 {{ chapterTotal }} 章</span>
          <NPagination
            :page="chapterPage"
            :page-count="chapterTotalPages"
            :page-size="pageSize"
            @update:page="(p: number) => { chapterPage = p; fetchTrash() }"
          />
        </div>
      </div>
    </template>
  </div>
</template>

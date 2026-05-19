<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const route = useRoute()
const novelId = computed(() => Number(route.params.id))

function getNovelTo() {
  return {
    path: `/novels/${novelId.value}`
  }
}

const { data: novel } = await useFetch(`/api/novels/${novelId.value}`)
const { data: chapters } = await useFetch(
  `/api/novels/${novelId.value}/chapters`
)

const currentChapterIndex = ref(0)
const readingMode = ref<'scroll' | 'page'>('scroll')
const fontSize = ref(18)

const sortedChapters = computed(() => {
  if (!chapters.value) return []
  return [...(chapters.value as any[])].sort(
    (a, b) => a.chapterNumber - b.chapterNumber
  )
})

const currentChapter = computed(
  () => sortedChapters.value[currentChapterIndex.value]
)

function nextChapter() {
  if (currentChapterIndex.value < sortedChapters.value.length - 1) {
    currentChapterIndex.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function prevChapter() {
  if (currentChapterIndex.value > 0) {
    currentChapterIndex.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800"
    >
      <div
        class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <NButton quaternary size="small" @click="navigateTo(getNovelTo())">
            <template #icon>
              <Icon icon="lucide:arrow-left" />
            </template>
          </NButton>
          <div class="min-w-0">
            <p
              class="text-sm font-medium text-gray-900 dark:text-white truncate"
            >
              {{ (novel as any)?.title }}
            </p>
            <p class="text-xs text-gray-400">{{ currentChapter?.title }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <NButton size="tiny" quaternary @click="fontSize = Math.max(14, fontSize - 2)">
            <template #icon>
              <Icon icon="lucide:minus" />
            </template>
          </NButton>
          <span class="text-xs text-gray-400 w-8 text-center">{{
            fontSize
          }}</span>
          <NButton size="tiny" quaternary @click="fontSize = Math.min(28, fontSize + 2)">
            <template #icon>
              <Icon icon="lucide:plus" />
            </template>
          </NButton>
          <NButton
            size="tiny"
            :type="readingMode === 'scroll' ? 'primary' : 'default'"
            :quaternary="readingMode !== 'scroll'"
            @click="readingMode = 'scroll'"
          >
            <template #icon>
              <Icon icon="lucide:scroll-text" />
            </template>
          </NButton>
          <NButton
            size="tiny"
            :type="readingMode === 'page' ? 'primary' : 'default'"
            :quaternary="readingMode !== 'page'"
            @click="readingMode = 'page'"
          >
            <template #icon>
              <Icon icon="lucide:book-open" />
            </template>
          </NButton>
        </div>
      </div>
    </div>

    <!-- Scroll Mode -->
    <div
      v-if="readingMode === 'scroll'"
      class="max-w-3xl mx-auto px-6 py-10"
    >
      <div
        v-for="(ch, idx) in sortedChapters"
        :key="ch.id"
        class="mb-16"
      >
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-6">
          {{ ch.title || `第${ch.chapterNumber}章` }}
        </h2>
        <div
          class="text-gray-800 dark:text-gray-200 leading-loose whitespace-pre-wrap"
          :style="{ fontSize: fontSize + 'px' }"
        >
          {{ ch.content || '' }}
        </div>
      </div>
    </div>

    <!-- Page Mode -->
    <div
      v-else
      class="max-w-3xl mx-auto px-6 py-10"
    >
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-6">
        {{ currentChapter?.title || `第${currentChapter?.chapterNumber}章` }}
      </h2>
      <div
        class="text-gray-800 dark:text-gray-200 leading-loose whitespace-pre-wrap min-h-[60vh]"
        :style="{ fontSize: fontSize + 'px' }"
      >
        {{ currentChapter?.content || '' }}
      </div>

      <!-- Page Navigation -->
      <div
        class="flex items-center justify-between mt-10 pt-6 border-t border-gray-200 dark:border-gray-800"
      >
        <NButton quaternary :disabled="currentChapterIndex === 0" @click="prevChapter">
          <template #icon>
            <Icon icon="lucide:chevron-left" />
          </template>
          上一章
        </NButton>
        <span class="text-sm text-gray-400">
          {{ currentChapterIndex + 1 }} / {{ sortedChapters.length }}
        </span>
        <NButton quaternary :disabled="currentChapterIndex >= sortedChapters.length - 1" @click="nextChapter">
          下一章
          <template #icon>
            <Icon icon="lucide:chevron-right" />
          </template>
        </NButton>
      </div>
    </div>
  </div>
</template>

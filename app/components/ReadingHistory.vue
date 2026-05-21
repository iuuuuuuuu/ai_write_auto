<script setup lang="ts">
const { recentHistory, clearHistory } = useReadingHistory()
const message = useMessage()

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}天前`
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function handleClear() {
  clearHistory()
  message.success('阅读历史已清空')
}
</script>

<template>
  <section v-if="recentHistory.length">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider">
        最近阅读
      </h2>
      <NButton
        size="tiny"
        quaternary
        @click="handleClear"
      >
        清空
      </NButton>
    </div>
    <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      <NuxtLink
        v-for="item in recentHistory"
        :key="item.chapterId"
        :to="`/novels/${item.novelId}/read`"
        class="group flex-none w-48 p-2.5 card-surface hover:border-(--ui-border-accented) transition-all duration-200"
        @click="$emit('navigate')"
      >
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-[10px] font-semibold text-(--ui-text-dimmed) bg-(--ui-bg-muted) px-1.5 py-0.5 rounded">
            第{{ item.chapterNumber }}章
          </span>
          <span class="text-[10px] text-(--ui-text-dimmed)">
            {{ formatRelativeTime(item.readAt) }}
          </span>
        </div>
        <p class="text-[13px] font-medium text-(--ui-text) truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {{ item.chapterTitle }}
        </p>
        <p class="text-[11px] text-(--ui-text-dimmed) truncate mt-0.5">
          {{ item.novelTitle }}
        </p>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
interface ChapterDetail {
  id: number
  chapterNumber: number
  title: string
  content: string | null
  summary: string | null
  wordCount: number | null
  updatedAt: string | Date
}

const props = defineProps<{
  chapter: ChapterDetail | null
  editTo: string | null
}>()

const contentPreview = computed(() => {
  const content = props.chapter?.content?.trim()
  if (content) return content
  return '这一章还没有正文内容。'
})

const updatedAtText = computed(() => {
  if (!props.chapter?.updatedAt) return '尚未更新'
  return new Date(props.chapter.updatedAt).toLocaleString('zh-CN')
})
</script>

<template>
  <section
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) shadow-sm"
  >
    <div
      v-if="props.chapter"
      class="flex h-full flex-col"
    >
      <!-- Header -->
      <div class="shrink-0 border-b border-(--ui-border) px-5 py-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex h-5 items-center rounded-md bg-(--ui-bg-accented) px-1.5 text-[11px] font-semibold uppercase tracking-wider text-(--ui-text-dimmed)"
              >
                Ch. {{ props.chapter.chapterNumber }}
              </span>
              <span class="text-[11px] tabular-nums text-(--ui-text-dimmed)">
                {{ props.chapter.wordCount || 0 }} 字
              </span>
            </div>
            <h2
              class="mt-2 truncate text-lg font-semibold text-(--ui-text-highlighted)"
            >
              {{ props.chapter.title }}
            </h2>
            <p class="mt-1 text-xs text-(--ui-text-dimmed)">
              {{ updatedAtText }}
            </p>
          </div>
          <NButton
            v-if="props.editTo"
            size="small"
            secondary
            @click="navigateTo(props.editTo)"
          >
            <template #icon>
              <Icon icon="lucide:pen-line" />
            </template>
            编辑
          </NButton>
        </div>

        <p
          v-if="props.chapter.summary"
          class="mt-3 rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-3 text-sm leading-relaxed text-(--ui-text-muted)"
        >
          {{ props.chapter.summary }}
        </p>
      </div>

      <!-- Content -->
      <div class="min-h-0 flex-1 overflow-y-auto p-5">
        <div
          v-if="props.chapter.content?.trim()"
          class="whitespace-pre-wrap text-sm leading-[1.85] text-(--ui-text)"
        >
          {{ contentPreview }}
        </div>
        <div
          v-else
          class="flex flex-col items-center justify-center py-16 text-center"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--ui-bg-accented)"
          >
            <Icon
              icon="lucide:pen-tool"
              class="h-5 w-5 text-(--ui-text-dimmed)"
            />
          </div>
          <p class="mt-3 text-sm font-medium text-(--ui-text-muted)">
            这一章还没有正文内容
          </p>
          <p class="mt-1 text-xs text-(--ui-text-dimmed)">
            点击上方编辑按钮开始写作，或使用 AI 生成
          </p>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center p-8 text-center"
    >
      <div
        class="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--ui-bg-accented)"
      >
        <Icon
          icon="lucide:book-open"
          class="h-6 w-6 text-(--ui-text-dimmed)"
        />
      </div>
      <p class="mt-4 text-sm font-medium text-(--ui-text-muted)">
        选择一个章节查看详情
      </p>
      <p class="mt-1 text-xs text-(--ui-text-dimmed)">
        从左侧列表中点击任意章节
      </p>
    </div>
  </section>
</template>

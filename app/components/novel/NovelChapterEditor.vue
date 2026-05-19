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
}>()

const emit = defineEmits<{
  save: [content: string]
  generate: []
}>()

const content = ref('')
const saving = ref(false)
const lastSaved = ref<Date | null>(null)
let saveTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.chapter?.id,
  (newId, oldId) => {
    if (newId !== oldId && props.chapter) {
      content.value = props.chapter.content || ''
    } else if (!props.chapter) {
      content.value = ''
    }
  },
  { immediate: true }
)

watch(content, () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(autoSave, 3000)
})

async function autoSave() {
  if (!props.chapter || content.value === (props.chapter.content || '')) return
  await doSave()
}

async function doSave() {
  if (!props.chapter) return
  saving.value = true
  try {
    emit('save', content.value)
    lastSaved.value = new Date()
  } finally {
    saving.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    doSave()
  }
}

const wordCount = computed(() => content.value.replace(/\s/g, '').length)

const updatedAtText = computed(() => {
  if (!props.chapter?.updatedAt) return '尚未更新'
  return new Date(props.chapter.updatedAt).toLocaleString('zh-CN')
})

onBeforeUnmount(() => {
  if (saveTimeout) clearTimeout(saveTimeout)
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
                {{ wordCount }} 字
              </span>
            </div>
            <h2
              class="mt-2 truncate text-lg font-semibold text-(--ui-text-highlighted)"
            >
              {{ props.chapter.title }}
            </h2>
            <p class="mt-1 text-xs text-(--ui-text-dimmed)">
              {{ updatedAtText }}
              <span v-if="saving"> · 保存中...</span>
              <span v-else-if="lastSaved">
                · 已保存 {{ lastSaved.toLocaleTimeString('zh-CN') }}
              </span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-sparkles"
              size="sm"
              variant="soft"
              @click="emit('generate')"
            >
              AI 生成
            </UButton>
            <UButton
              size="sm"
              :loading="saving"
              @click="doSave"
            >
              保存
            </UButton>
          </div>
        </div>

        <p
          v-if="props.chapter.summary"
          class="mt-3 rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-3 text-sm leading-relaxed text-(--ui-text-muted)"
        >
          {{ props.chapter.summary }}
        </p>
      </div>

      <!-- Editor -->
      <div class="min-h-0 flex-1 overflow-y-auto p-5">
        <textarea
          v-model="content"
          class="h-full w-full resize-none bg-transparent text-sm leading-[1.85] text-(--ui-text) outline-none placeholder:text-(--ui-text-dimmed)"
          :placeholder="'开始写作...\n\n快捷键：Ctrl + S 保存'"
          @keydown="handleKeydown"
        />
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
        <UIcon
          name="i-lucide-book-open"
          class="h-6 w-6 text-(--ui-text-dimmed)"
        />
      </div>
      <p class="mt-4 text-sm font-medium text-(--ui-text-muted)">
        选择一个章节开始编辑
      </p>
      <p class="mt-1 text-xs text-(--ui-text-dimmed)">
        从左侧列表中点击任意章节
      </p>
    </div>
  </section>
</template>

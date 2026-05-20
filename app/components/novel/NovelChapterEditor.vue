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
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-elevated)"
  >
    <div
      v-if="props.chapter"
      class="flex h-full flex-col"
    >
      <!-- Header -->
      <div class="shrink-0 border-b border-(--ui-border)/60 px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h2 class="truncate text-sm font-semibold text-(--ui-text-highlighted)">
                {{ props.chapter.title }}
              </h2>
              <span class="text-[11px] tabular-nums text-(--ui-text-dimmed) shrink-0">
                {{ wordCount }} 字
              </span>
            </div>
            <p class="mt-0.5 text-[11px] text-(--ui-text-dimmed)">
              <span v-if="saving">保存中...</span>
              <span v-else-if="lastSaved">已保存 {{ lastSaved.toLocaleTimeString('zh-CN') }}</span>
              <span v-else>{{ updatedAtText }}</span>
            </p>
          </div>
          <div class="flex items-center gap-1.5">
            <NButton
              size="tiny"
              quaternary
              @click="emit('generate')"
            >
              <template #icon>
                <Icon icon="lucide:sparkles" />
              </template>
            </NButton>
            <NButton
              size="tiny"
              type="primary"
              :loading="saving"
              @click="doSave"
            >
              <template #icon>
                <Icon icon="lucide:save" />
              </template>
            </NButton>
          </div>
        </div>
      </div>

      <!-- Editor -->
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <textarea
          v-model="content"
          class="h-full w-full resize-none bg-transparent text-sm leading-[1.9] text-(--ui-text) outline-none placeholder:text-(--ui-text-dimmed)/60"
          :placeholder="'开始写作...\n\nCtrl + S 保存'"
          @keydown="handleKeydown"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center p-8 text-center"
    >
      <Icon icon="lucide:pen-line" class="h-6 w-6 text-(--ui-text-dimmed)/60" />
      <p class="mt-3 text-sm text-(--ui-text-muted)">选择章节开始编辑</p>
    </div>
  </section>
</template>

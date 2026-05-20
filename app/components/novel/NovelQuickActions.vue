<script setup lang="ts">
interface QuickActionChapter {
  id: number
  title: string
  content: string | null
  wordCount: number | null
}

interface ChapterCharacter {
  id: number
  name: string
  description: string | null
  traits: string | null
  currentState: string | null
}

interface AllCharacter {
  id: number
  name: string
}

const props = defineProps<{
  readTo: string
  selectedChapter: QuickActionChapter | null
  chapterCharacters: ChapterCharacter[]
  allCharacters?: AllCharacter[]
  chapterCount: number
  characterCount: number
  outlineCount: number
}>()

const emit = defineEmits<{
  createChapter: []
  createCharacter: []
  exportNovel: [format: string]
  generate: []
  expand: []
  assignCharacter: [characterId: number]
  unassignCharacter: [characterId: number]
}>()

const selectedChapterWords = computed(
  () => props.selectedChapter?.wordCount || 0
)
const hasSelectedChapterContent = computed(() =>
  Boolean(props.selectedChapter?.content?.trim())
)

const unassignedCharacters = computed(() => {
  if (!props.allCharacters) return []
  const assignedIds = new Set(props.chapterCharacters.map(c => c.id))
  return props.allCharacters.filter(c => !assignedIds.has(c.id))
})
</script>

<template>
  <aside class="flex flex-col gap-2.5">
    <!-- Quick Actions -->
    <section class="rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-elevated) p-3">
      <p class="text-[11px] font-medium text-(--ui-text-dimmed) uppercase tracking-wider mb-2.5">操作</p>
      <div class="grid grid-cols-2 gap-1.5">
        <NButton block size="small" type="primary" @click="emit('createChapter')">
          <template #icon><Icon icon="lucide:plus" /></template>
          新章节
        </NButton>
        <NButton block size="small" secondary @click="emit('createCharacter')">
          <template #icon><Icon icon="lucide:user-plus" /></template>
          新角色
        </NButton>
      </div>
      <NButton class="mt-1.5" block size="small" quaternary @click="navigateTo(props.readTo)">
        <template #icon><Icon icon="lucide:book-open" /></template>
        阅读全文
      </NButton>
    </section>

    <!-- Chapter Characters -->
    <section
      v-if="props.selectedChapter"
      class="rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-elevated) p-3"
    >
      <div class="flex items-center justify-between mb-2">
        <p class="text-[11px] font-medium text-(--ui-text-dimmed) uppercase tracking-wider">本章角色</p>
        <span class="text-[10px] tabular-nums text-(--ui-text-dimmed)">{{ props.chapterCharacters.length }}</span>
      </div>
      <div v-if="props.chapterCharacters.length" class="flex flex-wrap gap-1 mb-2">
        <NTooltip v-for="char in props.chapterCharacters" :key="char.id">
          <template #trigger>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary-500/8 text-primary-600 dark:text-primary-400 cursor-default group">
              {{ char.name }}
              <button
                class="opacity-0 group-hover:opacity-100 transition-opacity text-primary-400 hover:text-red-500"
                @click="emit('unassignCharacter', char.id)"
              >
                <Icon icon="lucide:x" class="w-2.5 h-2.5" />
              </button>
            </span>
          </template>
          {{ char.description || char.name }}
        </NTooltip>
      </div>
      <p v-else class="text-[11px] text-(--ui-text-dimmed) mb-2">暂未分配角色</p>

      <!-- Quick assign from unassigned -->
      <div v-if="unassignedCharacters.length" class="border-t border-(--ui-border)/40 pt-2 mt-1">
        <p class="text-[10px] text-(--ui-text-dimmed) mb-1.5">快速添加：</p>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="char in unassignedCharacters.slice(0, 6)"
            :key="char.id"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-(--ui-text-muted) border border-(--ui-border)/40 hover:border-primary-500/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            @click="emit('assignCharacter', char.id)"
          >
            <Icon icon="lucide:plus" class="w-2.5 h-2.5" />
            {{ char.name }}
          </button>
        </div>
      </div>
    </section>

    <!-- AI Generate -->
    <section
      v-if="props.selectedChapter"
      class="rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-elevated) p-3"
    >
      <p class="text-[11px] font-medium text-(--ui-text-dimmed) uppercase tracking-wider mb-2.5">AI 辅助</p>
      <div class="space-y-1.5">
        <NButton block size="small" type="primary" @click="emit('generate')">
          <template #icon><Icon icon="lucide:wand-sparkles" /></template>
          生成章节
        </NButton>
        <NButton block size="small" secondary :disabled="!hasSelectedChapterContent" @click="emit('expand')">
          <template #icon><Icon icon="lucide:expand" /></template>
          扩写/改写
        </NButton>
      </div>
    </section>

    <!-- Stats -->
    <section class="rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-elevated) p-3">
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-(--ui-text-dimmed)">章节</span>
        <span class="font-medium tabular-nums text-(--ui-text)">{{ props.chapterCount }}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] mt-1.5">
        <span class="text-(--ui-text-dimmed)">角色</span>
        <span class="font-medium tabular-nums text-(--ui-text)">{{ props.characterCount }}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] mt-1.5">
        <span class="text-(--ui-text-dimmed)">大纲</span>
        <span class="font-medium tabular-nums text-(--ui-text)">{{ props.outlineCount }}</span>
      </div>
    </section>

    <!-- Export -->
    <section class="rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-elevated) p-3">
      <p class="text-[11px] font-medium text-(--ui-text-dimmed) uppercase tracking-wider mb-2">导出</p>
      <div class="grid grid-cols-3 gap-1.5">
        <NButton size="tiny" secondary @click="emit('exportNovel', 'txt')">TXT</NButton>
        <NButton size="tiny" secondary @click="emit('exportNovel', 'md')">MD</NButton>
        <NButton size="tiny" secondary @click="emit('exportNovel', 'epub')">EPUB</NButton>
      </div>
    </section>
  </aside>
</template>

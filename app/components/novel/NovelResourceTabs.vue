<script setup lang="ts">
type NovelPanelTab = 'chapters' | 'characters' | 'outline'
interface ChapterItem { id: number; chapterNumber: number; title: string; summary: string | null; status: 'draft' | 'generated' | 'edited' | 'final'; wordCount: number | null }
interface CharacterItem { id: number; name: string; description: string | null; traits: string | null; relationships: string | null; currentState: string | null }
interface OutlineItem { id: number; chapterNumber: number; description: string }

const activeTab = defineModel<NovelPanelTab>('activeTab', { required: true })
const selectedChapterId = defineModel<number | null>('selectedChapterId', { required: true })

const props = defineProps<{ chapters: ChapterItem[]; characters: CharacterItem[]; outlines: OutlineItem[] }>()
const emit = defineEmits<{ createChapter: []; createCharacter: []; editCharacter: [character: CharacterItem]; deleteCharacter: [characterId: number] }>()

const tabs = [
  { key: 'chapters', label: '章节', icon: 'lucide:file-text' },
  { key: 'characters', label: '角色', icon: 'lucide:users' },
  { key: 'outline', label: '大纲', icon: 'lucide:list' }
] as const

const searchQuery = shallowRef('')
const filteredChapters = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.chapters
  return props.chapters.filter(c => c.title.toLowerCase().includes(q) || (c.summary?.toLowerCase() || '').includes(q))
})

function getStatusColor(status: ChapterItem['status']) {
  if (status === 'final') return 'bg-emerald-500/10 text-emerald-600'
  if (status === 'generated') return 'bg-blue-500/10 text-blue-600'
  if (status === 'edited') return 'bg-amber-500/10 text-amber-600'
  return 'bg-(--ui-bg-muted) text-(--ui-text-dimmed)'
}
function selectChapter(chapterId: number) { selectedChapterId.value = chapterId; activeTab.value = 'chapters' }
</script>

<template>
  <aside class="flex flex-col overflow-hidden card-surface">
    <div class="flex border-b border-(--ui-border)/40 px-1 pt-1">
      <button v-for="tab in tabs" :key="tab.key"
        class="relative flex flex-1 items-center justify-center gap-1 rounded-t-md px-2 py-1.5 text-[11px] font-semibold transition-all duration-200"
        :class="activeTab === tab.key ? 'text-primary-600 bg-primary-500/[0.06]' : 'text-(--ui-text-dimmed) hover:text-(--ui-text-muted) hover:bg-(--ui-bg-muted)/40'"
        @click="activeTab = tab.key">
        <Icon :icon="tab.icon" class="h-3 w-3" /><span>{{ tab.label }}</span>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-1.5">
      <div v-show="activeTab === 'chapters'" class="space-y-0.5">
        <div class="flex items-center justify-between gap-1.5 px-0.5 mb-1">
          <NInput v-model:value="searchQuery" size="tiny" placeholder="搜索..." class="flex-1">
            <template #prefix><Icon icon="lucide:search" class="w-3 h-3 text-(--ui-text-dimmed)" /></template>
          </NInput>
          <button class="flex items-center justify-center w-6 h-6 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors shrink-0" @click="emit('createChapter')">
            <Icon icon="lucide:plus" class="w-3.5 h-3.5" />
          </button>
        </div>
        <div v-if="filteredChapters.length" class="space-y-0.5">
          <button v-for="chapter in filteredChapters" :key="chapter.id"
            class="group w-full rounded-md px-2 py-1.5 text-left transition-all duration-150"
            :class="selectedChapterId === chapter.id ? 'bg-primary-500/[0.06]' : 'hover:bg-(--ui-bg-muted)/60'"
            @click="selectChapter(chapter.id)">
            <div class="flex items-center gap-1.5">
              <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold font-mono"
                :class="selectedChapterId === chapter.id ? 'bg-primary-500/15 text-primary-600' : 'bg-(--ui-bg-accented) text-(--ui-text-dimmed)'">{{ chapter.chapterNumber }}</span>
              <span class="flex-1 truncate text-[12px] font-medium" :class="selectedChapterId === chapter.id ? 'text-primary-600' : 'text-(--ui-text)'">{{ chapter.title }}</span>
              <span v-if="chapter.wordCount" class="shrink-0 text-[9px] font-mono text-(--ui-text-dimmed)">{{ chapter.wordCount }}</span>
            </div>
            <div v-if="chapter.summary" class="mt-0.5 truncate text-[10px] text-(--ui-text-dimmed) pl-5">{{ chapter.summary }}</div>
          </button>
        </div>
        <div v-else class="py-4 text-center text-[11px] text-(--ui-text-dimmed)">暂无章节</div>
      </div>

      <div v-show="activeTab === 'characters'" class="space-y-1">
        <div class="flex items-center justify-between px-0.5 mb-1">
          <span class="text-[10px] font-bold text-(--ui-text-dimmed) uppercase tracking-wider">角色列表</span>
          <button class="flex items-center justify-center w-6 h-6 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors" @click="emit('createCharacter')">
            <Icon icon="lucide:plus" class="w-3.5 h-3.5" />
          </button>
        </div>
        <div v-if="props.characters.length" class="space-y-0.5">
          <div v-for="char in props.characters" :key="char.id"
            class="group flex items-start gap-1.5 rounded-md px-2 py-1.5 hover:bg-(--ui-bg-muted)/60 transition-colors cursor-pointer"
            @click="emit('editCharacter', char)">
            <div class="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white" style="background: linear-gradient(135deg, var(--ui-primary-300), var(--ui-primary-500));">
              {{ char.name.charAt(0) }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-medium text-(--ui-text) truncate">{{ char.name }}</p>
              <p v-if="char.description" class="text-[10px] text-(--ui-text-dimmed) truncate">{{ char.description }}</p>
            </div>
            <button class="opacity-0 group-hover:opacity-100 text-(--ui-text-dimmed) hover:text-red-500 transition-opacity shrink-0 mt-0.5" @click.stop="emit('deleteCharacter', char.id)">
              <Icon icon="lucide:trash-2" class="w-3 h-3" />
            </button>
          </div>
        </div>
        <div v-else class="py-4 text-center text-[11px] text-(--ui-text-dimmed)">暂无角色</div>
      </div>

      <div v-show="activeTab === 'outline'" class="space-y-1">
        <div class="px-0.5 mb-1">
          <span class="text-[10px] font-bold text-(--ui-text-dimmed) uppercase tracking-wider">大纲</span>
        </div>
        <div v-if="props.outlines.length" class="space-y-0.5">
          <div v-for="outline in props.outlines" :key="outline.id" class="flex items-start gap-1.5 rounded-md px-2 py-1.5 hover:bg-(--ui-bg-muted)/60 transition-colors">
            <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold font-mono bg-(--ui-bg-accented) text-(--ui-text-dimmed)">{{ outline.chapterNumber }}</span>
            <p class="text-[11px] text-(--ui-text-muted) leading-relaxed">{{ outline.description }}</p>
          </div>
        </div>
        <div v-else class="py-4 text-center text-[11px] text-(--ui-text-dimmed)">暂无大纲</div>
      </div>
    </div>
  </aside>
</template>
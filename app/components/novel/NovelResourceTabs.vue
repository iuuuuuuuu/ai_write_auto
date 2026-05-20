<script setup lang="ts">
type NovelPanelTab = 'chapters' | 'characters' | 'outline'

interface ChapterItem {
  id: number
  chapterNumber: number
  title: string
  summary: string | null
  status: 'draft' | 'generated' | 'edited' | 'final'
  wordCount: number | null
}

interface CharacterItem {
  id: number
  name: string
  description: string | null
  traits: string | null
  relationships: string | null
  currentState: string | null
}

interface OutlineItem {
  id: number
  chapterNumber: number
  description: string
}

const activeTab = defineModel<NovelPanelTab>('activeTab', { required: true })
const selectedChapterId = defineModel<number | null>('selectedChapterId', {
  required: true
})

const props = defineProps<{
  chapters: ChapterItem[]
  characters: CharacterItem[]
  outlines: OutlineItem[]
}>()

const emit = defineEmits<{
  createChapter: []
  createCharacter: []
  editCharacter: [character: CharacterItem]
  deleteCharacter: [characterId: number]
}>()

const tabs = [
  { key: 'chapters', label: '章节', icon: 'lucide:file-text' },
  { key: 'characters', label: '角色', icon: 'lucide:users' },
  { key: 'outline', label: '大纲', icon: 'lucide:list' }
] satisfies Array<{ key: NovelPanelTab; label: string; icon: string }>

const searchQuery = shallowRef('')

const filteredChapters = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.chapters
  return props.chapters.filter(
    (chapter) =>
      chapter.title.toLowerCase().includes(query) ||
      (chapter.summary?.toLowerCase() || '').includes(query)
  )
})

function getStatusColor(status: ChapterItem['status']) {
  if (status === 'final') return 'success'
  if (status === 'generated') return 'info'
  if (status === 'edited') return 'warning'
  return 'default'
}

function selectChapter(chapterId: number) {
  selectedChapterId.value = chapterId
  activeTab.value = 'chapters'
}
</script>

<template>
  <aside
    class="flex flex-col overflow-hidden rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-elevated)"
  >
    <!-- Tabs -->
    <div class="flex border-b border-(--ui-border)/60 px-1 pt-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="relative flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 py-2 text-xs font-medium transition-colors duration-200"
        :class="
          activeTab === tab.key ?
            'text-(--ui-text-highlighted) bg-(--ui-bg-muted)/50'
          : 'text-(--ui-text-dimmed) hover:text-(--ui-text-muted)'
        "
        @click="activeTab = tab.key"
      >
        <Icon
          :icon="tab.icon"
          class="h-3.5 w-3.5"
        />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- Chapters -->
      <div
        v-show="activeTab === 'chapters'"
        class="space-y-1.5"
      >
        <div class="flex items-center justify-between gap-2 px-1 mb-1.5">
          <NInput
            v-model:value="searchQuery"
            size="small"
            placeholder="搜索..."
            class="flex-1"
          >
            <template #prefix>
              <Icon icon="lucide:search" class="w-3 h-3 text-(--ui-text-dimmed)" />
            </template>
          </NInput>
          <button
            class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors shrink-0"
            @click="emit('createChapter')"
          >
            <Icon icon="lucide:plus" class="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          v-if="filteredChapters.length"
          class="space-y-0.5"
        >
          <button
            v-for="chapter in filteredChapters"
            :key="chapter.id"
            class="group w-full rounded-lg px-2.5 py-2 text-left transition-all duration-150"
            :class="
              selectedChapterId === chapter.id ?
                'bg-primary-500/8'
              : 'hover:bg-(--ui-bg-muted)/80'
            "
            @click="selectChapter(chapter.id)"
          >
            <div class="flex items-center gap-2">
              <span
                class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold tabular-nums"
                :class="
                  selectedChapterId === chapter.id
                    ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400'
                    : 'bg-(--ui-bg-accented) text-(--ui-text-dimmed)'
                "
              >
                {{ chapter.chapterNumber }}
              </span>
              <p
                class="truncate text-[13px] font-medium flex-1"
                :class="
                  selectedChapterId === chapter.id ?
                    'text-(--ui-text-highlighted)'
                  : 'text-(--ui-text)'
                "
              >
                {{ chapter.title }}
              </p>
              <span class="text-[10px] tabular-nums text-(--ui-text-dimmed) shrink-0">
                {{ chapter.wordCount || 0 }}字
              </span>
            </div>
          </button>
        </div>

        <div
          v-else-if="!searchQuery.trim()"
          class="flex flex-col items-center py-10 text-center"
        >
          <Icon icon="lucide:file-text" class="h-5 w-5 text-(--ui-text-dimmed)" />
          <p class="mt-2 text-xs text-(--ui-text-muted)">暂无章节</p>
          <button
            class="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
            @click="emit('createChapter')"
          >
            新建章节
          </button>
        </div>
        <div v-else class="py-6 text-center">
          <p class="text-xs text-(--ui-text-dimmed)">未找到匹配章节</p>
        </div>
      </div>

      <!-- Characters -->
      <div
        v-show="activeTab === 'characters'"
        class="space-y-1.5"
      >
        <div class="flex items-center justify-between px-1 mb-1.5">
          <p class="text-[11px] text-(--ui-text-dimmed)">
            {{ props.characters.length }} 个角色
          </p>
          <button
            class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
            @click="emit('createCharacter')"
          >
            <Icon icon="lucide:plus" class="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          v-if="props.characters.length"
          class="space-y-0.5"
        >
          <div
            v-for="character in props.characters"
            :key="character.id"
            class="group rounded-lg px-2.5 py-2 transition-colors hover:bg-(--ui-bg-muted)/80"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-[13px] font-medium text-(--ui-text) truncate">
                {{ character.name }}
              </p>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="flex items-center justify-center w-5 h-5 rounded text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated) transition-colors"
                  @click="emit('editCharacter', character)"
                >
                  <Icon icon="lucide:pencil" class="w-3 h-3" />
                </button>
                <button
                  class="flex items-center justify-center w-5 h-5 rounded text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-500/5 transition-colors"
                  @click="emit('deleteCharacter', character.id)"
                >
                  <Icon icon="lucide:trash-2" class="w-3 h-3" />
                </button>
              </div>
            </div>
            <p
              v-if="character.description"
              class="mt-0.5 line-clamp-1 text-[11px] text-(--ui-text-dimmed)"
            >
              {{ character.description }}
            </p>
          </div>
        </div>

        <div v-else class="flex flex-col items-center py-10 text-center">
          <Icon icon="lucide:users" class="h-5 w-5 text-(--ui-text-dimmed)" />
          <p class="mt-2 text-xs text-(--ui-text-muted)">暂无角色</p>
          <button
            class="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
            @click="emit('createCharacter')"
          >
            新建角色
          </button>
        </div>
      </div>

      <!-- Outline -->
      <div
        v-show="activeTab === 'outline'"
        class="space-y-0.5"
      >
        <div
          v-if="props.outlines.length"
          class="space-y-0.5"
        >
          <div
            v-for="outline in props.outlines"
            :key="outline.id"
            class="flex gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-(--ui-bg-muted)/80"
          >
            <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-(--ui-bg-accented) text-[10px] font-semibold tabular-nums text-(--ui-text-dimmed)">
              {{ outline.chapterNumber }}
            </span>
            <p class="text-[13px] leading-relaxed text-(--ui-text-muted)">
              {{ outline.description }}
            </p>
          </div>
        </div>

        <div v-else class="flex flex-col items-center py-10 text-center">
          <Icon icon="lucide:list" class="h-5 w-5 text-(--ui-text-dimmed)" />
          <p class="mt-2 text-xs text-(--ui-text-muted)">暂无大纲</p>
        </div>
      </div>
    </div>
  </aside>
</template>

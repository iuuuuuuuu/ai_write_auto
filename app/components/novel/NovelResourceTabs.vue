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
  return 'neutral'
}

function selectChapter(chapterId: number) {
  selectedChapterId.value = chapterId
  activeTab.value = 'chapters'
}
</script>

<template>
  <aside
    class="flex flex-col overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) shadow-sm"
  >
    <!-- Tabs -->
    <div class="flex border-b border-(--ui-border)">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="relative flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors duration-200"
        :class="
          activeTab === tab.key ?
            'text-(--ui-primary)'
          : 'text-(--ui-text-muted) hover:text-(--ui-text)'
        "
        @click="activeTab = tab.key"
      >
        <Icon
          :icon="tab.icon"
          class="h-4 w-4"
        />
        <span>{{ tab.label }}</span>
        <span
          v-if="activeTab === tab.key"
          class="absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-(--ui-primary) transition-all duration-200"
        />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-3">
      <!-- Chapters -->
      <div
        v-show="activeTab === 'chapters'"
        class="space-y-2"
      >
        <div class="flex items-center justify-between gap-2 px-1">
          <p
            class="text-[11px] font-medium uppercase tracking-wider text-(--ui-text-dimmed)"
          >
            {{ filteredChapters.length }} 章
          </p>
          <NButton
            size="tiny"
            quaternary
            @click="emit('createChapter')"
          >
            <template #icon>
              <Icon icon="lucide:plus" />
            </template>
          </NButton>
        </div>

        <NInput
          v-model:value="searchQuery"
          size="small"
          placeholder="搜索章节..."
        >
          <template #prefix>
            <Icon icon="lucide:search" class="text-(--ui-text-dimmed)" />
          </template>
        </NInput>

        <div
          v-if="filteredChapters.length"
          class="space-y-1.5"
        >
          <button
            v-for="chapter in filteredChapters"
            :key="chapter.id"
            class="group w-full rounded-lg border p-3 text-left transition-all duration-200"
            :class="
              selectedChapterId === chapter.id ?
                'border-(--ui-primary)/20 bg-(--ui-primary)/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
              : 'border-transparent bg-(--ui-bg-muted)/60 hover:border-(--ui-border) hover:bg-(--ui-bg-muted)'
            "
            @click="selectChapter(chapter.id)"
          >
            <div class="flex items-center gap-3">
              <span
                class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-(--ui-bg-accented) text-center text-[11px] font-semibold tabular-nums text-(--ui-text-dimmed) transition-colors"
                :class="
                  selectedChapterId === chapter.id ? 'text-(--ui-primary)' : ''
                "
              >
                {{ chapter.chapterNumber }}
              </span>
              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-sm font-medium transition-colors"
                  :class="
                    selectedChapterId === chapter.id ?
                      'text-(--ui-text-highlighted)'
                    : 'text-(--ui-text)'
                  "
                >
                  {{ chapter.title }}
                </p>
                <p
                  v-if="chapter.summary"
                  class="mt-0.5 truncate text-xs text-(--ui-text-dimmed)"
                >
                  {{ chapter.summary }}
                </p>
              </div>
            </div>
            <div class="mt-2.5 flex items-center justify-between">
              <span class="text-[11px] tabular-nums text-(--ui-text-dimmed)">
                {{ chapter.wordCount || 0 }} 字
              </span>
              <NTag
                :type="getStatusColor(chapter.status)"
                size="small"
                class="text-[10px]"
              >
                {{ chapter.status }}
              </NTag>
            </div>
          </button>
        </div>

        <div
          v-else-if="!searchQuery.trim()"
          class="flex flex-col items-center py-12 text-center"
        >
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-(--ui-bg-accented)"
          >
            <Icon
              icon="lucide:file-text"
              class="h-5 w-5 text-(--ui-text-dimmed)"
            />
          </div>
          <p class="mt-3 text-sm text-(--ui-text-muted)">暂无章节</p>
          <NButton
            class="mt-3"
            size="small"
            secondary
            @click="emit('createChapter')"
          >
            <template #icon>
              <Icon icon="lucide:plus" />
            </template>
            新建章节
          </NButton>
        </div>
        <div
          v-else
          class="py-8 text-center"
        >
          <Icon
            icon="lucide:search-x"
            class="mx-auto h-6 w-6 text-(--ui-text-dimmed)"
          />
          <p class="mt-2 text-sm text-(--ui-text-muted)">未找到匹配章节</p>
        </div>
      </div>

      <!-- Characters -->
      <div
        v-show="activeTab === 'characters'"
        class="space-y-2"
      >
        <div class="flex items-center justify-between px-1">
          <p
            class="text-[11px] font-medium uppercase tracking-wider text-(--ui-text-dimmed)"
          >
            {{ props.characters.length }} 个角色
          </p>
          <NButton
            size="tiny"
            quaternary
            @click="emit('createCharacter')"
          >
            <template #icon>
              <Icon icon="lucide:plus" />
            </template>
          </NButton>
        </div>

        <div
          v-if="props.characters.length"
          class="space-y-1.5"
        >
          <div
            v-for="character in props.characters"
            :key="character.id"
            class="rounded-lg border border-transparent bg-(--ui-bg-muted)/60 p-3 transition-all duration-200 hover:border-(--ui-border) hover:bg-(--ui-bg-muted)"
          >
            <p class="text-sm font-medium text-(--ui-text)">
              {{ character.name }}
            </p>
            <p
              v-if="character.description"
              class="mt-1 line-clamp-2 text-xs leading-5 text-(--ui-text-muted)"
            >
              {{ character.description }}
            </p>
            <div class="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
              <span
                v-if="character.traits"
                class="inline-flex items-center gap-1 text-[11px] text-(--ui-text-dimmed)"
              >
                <span class="h-1 w-1 rounded-full bg-(--ui-text-dimmed)/50" />
                {{ character.traits }}
              </span>
              <span
                v-if="character.currentState"
                class="inline-flex items-center gap-1 text-[11px] text-(--ui-text-dimmed)"
              >
                <span class="h-1 w-1 rounded-full bg-(--ui-text-dimmed)/50" />
                {{ character.currentState }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-else
          class="flex flex-col items-center py-12 text-center"
        >
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-(--ui-bg-accented)"
          >
            <Icon
              icon="lucide:users"
              class="h-5 w-5 text-(--ui-text-dimmed)"
            />
          </div>
          <p class="mt-3 text-sm text-(--ui-text-muted)">暂无角色信息</p>
          <NButton
            class="mt-3"
            size="small"
            secondary
            @click="emit('createCharacter')"
          >
            <template #icon>
              <Icon icon="lucide:plus" />
            </template>
            新建角色
          </NButton>
        </div>
      </div>

      <!-- Outline -->
      <div
        v-show="activeTab === 'outline'"
        class="space-y-2"
      >
        <div
          v-if="props.outlines.length"
          class="space-y-1.5"
        >
          <div
            v-for="outline in props.outlines"
            :key="outline.id"
            class="flex gap-3 rounded-lg border border-transparent bg-(--ui-bg-muted)/60 p-3 transition-all duration-200 hover:border-(--ui-border) hover:bg-(--ui-bg-muted)"
          >
            <span
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-(--ui-bg-accented) text-center text-[11px] font-semibold tabular-nums text-(--ui-text-dimmed)"
            >
              {{ outline.chapterNumber }}
            </span>
            <p class="text-sm leading-relaxed text-(--ui-text-muted)">
              {{ outline.description }}
            </p>
          </div>
        </div>

        <div
          v-else
          class="flex flex-col items-center py-12 text-center"
        >
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-(--ui-bg-accented)"
          >
            <Icon
              icon="lucide:list"
              class="h-5 w-5 text-(--ui-text-dimmed)"
            />
          </div>
          <p class="mt-3 text-sm text-(--ui-text-muted)">暂无大纲</p>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
type NovelPanelTab = 'chapters' | 'characters' | 'outline' | 'workspace' | 'foreshadowing'
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
  novelId: number
}>()
const emit = defineEmits<{
  createChapter: []
  createCharacter: []
  editCharacter: [character: CharacterItem]
  deleteCharacter: [characterId: number]
  refresh: []
}>()

const tabs = [
  { key: 'chapters', label: '章节', icon: 'lucide:file-text' },
  { key: 'characters', label: '角色', icon: 'lucide:users' },
  { key: 'outline', label: '大纲', icon: 'lucide:list' },
  { key: 'workspace', label: '工作区', icon: 'lucide:sparkles' },
  { key: 'foreshadowing', label: '伏笔', icon: 'lucide:link' }
] as const

const searchQuery = shallowRef('')
const characterSearchQuery = shallowRef('')
const chapterStatusFilter = shallowRef<'all' | ChapterItem['status']>('all')
const chapterStatusOptions = computed(() => [
  { label: '全部', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '已生成', value: 'generated' },
  { label: '已编辑', value: 'edited' },
  { label: '已定稿', value: 'final' }
])
const filteredChapters = computed(() => {
  const q = normalizeSearchText(searchQuery.value)
  return props.chapters.filter((chapter) => {
    const statusMatched =
      chapterStatusFilter.value === 'all' ||
      chapter.status === chapterStatusFilter.value
    if (!statusMatched) return false
    if (!q) return true

    const searchable = normalizeSearchText(
      `${chapter.chapterNumber} ${chapter.title} ${chapter.summary || ''} ${chapter.wordCount || 0} ${getStatusLabel(chapter.status)}`
    )
    return searchable.includes(q)
  })
})

const chapterFilterText = computed(() => {
  if (!props.chapters.length) return '暂无章节'
  return `${filteredChapters.value.length} / ${props.chapters.length}`
})

const filteredCharacters = computed(() => {
  const query = normalizeSearchText(characterSearchQuery.value)
  if (!query) return props.characters

  return props.characters.filter((character) => {
    const searchable = normalizeSearchText(
      `${character.name} ${character.description || ''} ${character.traits || ''} ${character.currentState || ''} ${character.relationships || ''}`
    )
    return searchable.includes(query)
  })
})

const characterFilterText = computed(() => {
  if (!props.characters.length) return '暂无角色'
  return `${filteredCharacters.value.length} / ${props.characters.length}`
})

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase()
}

function getStatusLabel(status: ChapterItem['status']) {
  if (status === 'final') return '已定稿'
  if (status === 'generated') return '已生成'
  if (status === 'edited') return '已编辑'
  return '草稿'
}

function getStatusColor(status: ChapterItem['status']) {
  if (status === 'final') return 'bg-emerald-500/10 text-emerald-600'
  if (status === 'generated') return 'bg-blue-500/10 text-blue-600'
  if (status === 'edited') return 'bg-amber-500/10 text-amber-600'
  return 'bg-(--ui-bg-muted) text-(--ui-text-dimmed)'
}

function getCharacterInitial(character: CharacterItem) {
  return character.name.trim().charAt(0) || '角'
}

function selectChapter(chapterId: number) {
  selectedChapterId.value = chapterId
  activeTab.value = 'chapters'
}
</script>

<template>
  <aside class="flex flex-col overflow-hidden card-surface">
    <div class="flex border-b border-(--ui-border)/40 px-1 pt-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="relative flex flex-1 items-center justify-center gap-1 rounded-t-md px-2 py-1.5 text-[11px] font-semibold transition-all duration-200"
        :class="
          activeTab === tab.key ?
            'text-primary-600 bg-primary-500/[0.06]'
          : 'text-(--ui-text-dimmed) hover:text-(--ui-text-muted) hover:bg-(--ui-bg-muted)/40'
        "
        @click="activeTab = tab.key"
      >
        <Icon
          :icon="tab.icon"
          class="h-3 w-3"
        /><span>{{ tab.label }}</span>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-1.5">
      <div
        v-show="activeTab === 'chapters'"
        class="space-y-0.5"
      >
        <div class="space-y-1.5 px-0.5 mb-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-semibold text-(--ui-text-dimmed)">{{
              chapterFilterText
            }}</span>
            <button
              class="flex items-center justify-center w-6 h-6 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors shrink-0"
              @click="emit('createChapter')"
            >
              <Icon
                icon="lucide:plus"
                class="w-3.5 h-3.5"
              />
            </button>
          </div>
          <NInput
            v-model:value="searchQuery"
            size="tiny"
            clearable
            placeholder="搜编号、标题、摘要"
            class="flex-1"
          >
            <template #prefix
              ><Icon
                icon="lucide:search"
                class="w-3 h-3 text-(--ui-text-dimmed)"
            /></template>
          </NInput>
          <NSelect
            v-model:value="chapterStatusFilter"
            size="tiny"
            :options="chapterStatusOptions"
          />
        </div>
        <div
          v-if="filteredChapters.length"
          class="space-y-0.5"
        >
          <button
            v-for="chapter in filteredChapters"
            :key="chapter.id"
            class="group w-full rounded-md px-2 py-1.5 text-left transition-all duration-150"
            :class="
              selectedChapterId === chapter.id ?
                'bg-primary-500/[0.06]'
              : 'hover:bg-(--ui-bg-muted)/60'
            "
            @click="selectChapter(chapter.id)"
          >
            <div class="flex items-center gap-1.5">
              <span
                class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold font-mono"
                :class="
                  selectedChapterId === chapter.id ?
                    'bg-primary-500/15 text-primary-600'
                  : 'bg-(--ui-bg-accented) text-(--ui-text-dimmed)'
                "
                >{{ chapter.chapterNumber }}</span
              >
              <span
                class="flex-1 truncate text-[12px] font-medium"
                :class="
                  selectedChapterId === chapter.id ?
                    'text-primary-600'
                  : 'text-(--ui-text)'
                "
                >{{ chapter.title }}</span
              >
              <span
                v-if="chapter.wordCount"
                class="shrink-0 text-[9px] font-mono text-(--ui-text-dimmed)"
                >{{ chapter.wordCount }}</span
              >
            </div>
            <div
              v-if="chapter.summary"
              class="mt-0.5 truncate text-[10px] text-(--ui-text-dimmed) pl-5"
            >
              {{ chapter.summary }}
            </div>
          </button>
        </div>
        <div
          v-else
          class="py-4 text-center text-[11px] text-(--ui-text-dimmed)"
        >
          {{ props.chapters.length ? '没有匹配章节' : '暂无章节' }}
        </div>
      </div>

      <div
        v-show="activeTab === 'characters'"
        class="space-y-1"
      >
        <div class="space-y-1.5 px-0.5 mb-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-semibold text-(--ui-text-dimmed)">{{
              characterFilterText
            }}</span>
            <button
              class="flex items-center justify-center w-6 h-6 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors shrink-0"
              @click="emit('createCharacter')"
            >
              <Icon
                icon="lucide:plus"
                class="w-3.5 h-3.5"
              />
            </button>
          </div>
          <NInput
            v-model:value="characterSearchQuery"
            size="tiny"
            clearable
            placeholder="搜角色、特征、关系"
            class="flex-1"
          >
            <template #prefix>
              <Icon
                icon="lucide:search"
                class="w-3 h-3 text-(--ui-text-dimmed)"
              />
            </template>
          </NInput>
        </div>
        <div
          v-if="filteredCharacters.length"
          class="space-y-0.5"
        >
          <div
            v-for="char in filteredCharacters"
            :key="char.id"
            class="group rounded-md px-2 py-2 hover:bg-(--ui-bg-muted)/60 transition-colors cursor-pointer"
            @click="emit('editCharacter', char)"
          >
            <div class="flex items-start gap-2">
              <div
                class="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-semibold text-white"
                style="
                  background: linear-gradient(
                    135deg,
                    var(--ui-primary-300),
                    var(--ui-primary-500)
                  );
                "
              >
                {{ getCharacterInitial(char) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[12px] font-medium text-(--ui-text) truncate">
                  {{ char.name }}
                </p>
                <p
                  v-if="char.description"
                  class="text-[10px] text-(--ui-text-dimmed) line-clamp-2"
                >
                  {{ char.description }}
                </p>
                <div
                  v-if="char.traits || char.currentState"
                  class="mt-1 flex flex-wrap gap-1"
                >
                  <span
                    v-if="char.traits"
                    class="rounded bg-(--ui-bg-accented) px-1 py-0.5 text-[9px] text-(--ui-text-muted)"
                    >{{ char.traits }}</span
                  >
                  <span
                    v-if="char.currentState"
                    class="rounded bg-(--ui-bg-accented) px-1 py-0.5 text-[9px] text-(--ui-text-muted)"
                    >{{ char.currentState }}</span
                  >
                </div>
              </div>
              <button
                class="opacity-0 group-hover:opacity-100 text-(--ui-text-dimmed) hover:text-red-500 transition-opacity shrink-0 mt-0.5"
                @click.stop="emit('deleteCharacter', char.id)"
              >
                <Icon
                  icon="lucide:trash-2"
                  class="w-3 h-3"
                />
              </button>
            </div>
          </div>
        </div>
        <div
          v-else
          class="py-4 text-center text-[11px] text-(--ui-text-dimmed)"
        >
          {{ props.characters.length ? '没有匹配角色' : '暂无角色' }}
        </div>
      </div>

      <div
        v-show="activeTab === 'outline'"
        class="space-y-1"
      >
        <div class="px-0.5 mb-1">
          <span
            class="text-[10px] font-bold text-(--ui-text-dimmed) uppercase tracking-wider"
            >大纲</span
          >
        </div>
        <div
          v-if="props.outlines.length"
          class="space-y-0.5"
        >
          <div
            v-for="outline in props.outlines"
            :key="outline.id"
            class="flex items-start gap-1.5 rounded-md px-2 py-1.5 hover:bg-(--ui-bg-muted)/60 transition-colors"
          >
            <span
              class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold font-mono bg-(--ui-bg-accented) text-(--ui-text-dimmed)"
              >{{ outline.chapterNumber }}</span
            >
            <p class="text-[11px] text-(--ui-text-muted) leading-relaxed">
              {{ outline.description }}
            </p>
          </div>
        </div>
        <div
          v-else
          class="py-4 text-center text-[11px] text-(--ui-text-dimmed)"
        >
          暂无大纲
        </div>
      </div>

      <div v-show="activeTab === 'workspace'" class="space-y-3 p-1">
        <NovelWorkspacePanel :novel-id="props.novelId" :chapters="props.chapters" @refresh="$emit('refresh')" />
      </div>

      <div v-show="activeTab === 'foreshadowing'" class="p-1">
        <NovelForeshadowingPanel :novel-id="props.novelId" :chapters="props.chapters" />
      </div>
    </div>
  </aside>
</template>

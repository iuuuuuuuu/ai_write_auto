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

const props = defineProps<{
  readTo: string
  selectedChapter: QuickActionChapter | null
  chapterCharacters: ChapterCharacter[]
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
}>()

const selectedChapterWords = computed(
  () => props.selectedChapter?.wordCount || 0
)
const hasSelectedChapterContent = computed(() =>
  Boolean(props.selectedChapter?.content?.trim())
)
</script>

<template>
  <aside class="flex flex-col gap-3">
    <!-- Quick Actions -->
    <section
      class="rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) p-4 shadow-sm"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex h-6 w-6 items-center justify-center rounded-md bg-(--ui-bg-accented)"
        >
          <UIcon
            name="i-lucide-bolt"
            class="h-3.5 w-3.5 text-(--ui-primary)"
          />
        </div>
        <span
          class="text-xs font-semibold uppercase tracking-wider text-(--ui-text-muted)"
        >
          快捷操作
        </span>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2">
        <UButton
          block
          icon="i-lucide-plus"
          size="sm"
          @click="emit('createChapter')"
        >
          新章节
        </UButton>
        <UButton
          block
          icon="i-lucide-user-plus"
          size="sm"
          variant="soft"
          @click="emit('createCharacter')"
        >
          新角色
        </UButton>
      </div>

      <UButton
        class="mt-2"
        block
        icon="i-lucide-book-open"
        size="sm"
        variant="outline"
        color="neutral"
        :to="props.readTo"
      >
        阅读全文
      </UButton>
    </section>

    <!-- Chapter Characters -->
    <section
      v-if="props.selectedChapter"
      class="rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) p-4 shadow-sm"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex h-6 w-6 items-center justify-center rounded-md bg-(--ui-bg-accented)"
        >
          <UIcon
            name="i-lucide-users"
            class="h-3.5 w-3.5 text-(--ui-primary)"
          />
        </div>
        <span
          class="text-xs font-semibold uppercase tracking-wider text-(--ui-text-muted)"
        >
          本章角色
        </span>
        <span class="ml-auto text-[11px] tabular-nums text-(--ui-text-dimmed)">
          {{ props.chapterCharacters.length }}
        </span>
      </div>

      <div class="mt-3">
        <div
          v-if="props.chapterCharacters.length"
          class="flex flex-wrap gap-1.5"
        >
          <UTooltip
            v-for="char in props.chapterCharacters"
            :key="char.id"
            :text="char.description || char.name"
          >
            <UBadge
              variant="soft"
              color="primary"
              size="sm"
              class="cursor-default"
            >
              {{ char.name }}
            </UBadge>
          </UTooltip>
        </div>
        <p
          v-else
          class="text-xs text-(--ui-text-dimmed)"
        >
          本章暂未检测到角色
        </p>
      </div>
    </section>

    <!-- Generate -->
    <section
      v-if="props.selectedChapter"
      class="rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) p-4 shadow-sm"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex h-6 w-6 items-center justify-center rounded-md bg-(--ui-bg-accented)"
        >
          <UIcon
            name="i-lucide-sparkles"
            class="h-3.5 w-3.5 text-(--ui-primary)"
          />
        </div>
        <span
          class="text-xs font-semibold uppercase tracking-wider text-(--ui-text-muted)"
        >
          AI 生成
        </span>
      </div>

      <div class="mt-3 space-y-2">
        <UButton
          block
          icon="i-lucide-wand-sparkles"
          size="sm"
          @click="emit('generate')"
        >
          生成章节
        </UButton>
        <UButton
          block
          icon="i-lucide-expand"
          size="sm"
          variant="soft"
          :disabled="!hasSelectedChapterContent"
          @click="emit('expand')"
        >
          扩写/改写
        </UButton>
      </div>

      <div class="mt-3 rounded-lg bg-(--ui-bg-muted) px-3 py-2">
        <p class="truncate text-xs text-(--ui-text-muted)">
          当前：
          <span class="font-medium text-(--ui-text)">
            {{ props.selectedChapter.title }}
          </span>
          <span class="ml-1.5 tabular-nums text-(--ui-text-dimmed)">
            {{ selectedChapterWords }} 字
          </span>
        </p>
      </div>
    </section>

    <!-- Stats -->
    <section
      class="rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) p-4 shadow-sm"
    >
      <div class="grid grid-cols-3 gap-2">
        <div
          class="flex flex-col items-center rounded-lg border border-(--ui-border-muted) bg-(--ui-bg-muted) py-3 text-center transition-colors hover:border-(--ui-border)"
        >
          <p class="text-2xl font-bold tabular-nums text-(--ui-primary)">
            {{ props.chapterCount }}
          </p>
          <p
            class="mt-1 text-[10px] font-semibold uppercase tracking-wider text-(--ui-text-dimmed)"
          >
            章节
          </p>
        </div>
        <div
          class="flex flex-col items-center rounded-lg border border-(--ui-border-muted) bg-(--ui-bg-muted) py-3 text-center transition-colors hover:border-(--ui-border)"
        >
          <p class="text-2xl font-bold tabular-nums text-(--ui-primary)">
            {{ props.characterCount }}
          </p>
          <p
            class="mt-1 text-[10px] font-semibold uppercase tracking-wider text-(--ui-text-dimmed)"
          >
            角色
          </p>
        </div>
        <div
          class="flex flex-col items-center rounded-lg border border-(--ui-border-muted) bg-(--ui-bg-muted) py-3 text-center transition-colors hover:border-(--ui-border)"
        >
          <p class="text-2xl font-bold tabular-nums text-(--ui-primary)">
            {{ props.outlineCount }}
          </p>
          <p
            class="mt-1 text-[10px] font-semibold uppercase tracking-wider text-(--ui-text-dimmed)"
          >
            大纲
          </p>
        </div>
      </div>
    </section>

    <!-- Export -->
    <section
      class="rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) p-4 shadow-sm"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex h-6 w-6 items-center justify-center rounded-md bg-(--ui-bg-accented)"
        >
          <UIcon
            name="i-lucide-download"
            class="h-3.5 w-3.5 text-(--ui-primary)"
          />
        </div>
        <span
          class="text-xs font-semibold uppercase tracking-wider text-(--ui-text-muted)"
        >
          导出
        </span>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          class="text-xs"
          @click="emit('exportNovel', 'txt')"
        >
          TXT
        </UButton>
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          class="text-xs"
          @click="emit('exportNovel', 'md')"
        >
          MD
        </UButton>
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          class="text-xs"
          @click="emit('exportNovel', 'epub')"
        >
          EPUB
        </UButton>
      </div>
    </section>
  </aside>
</template>

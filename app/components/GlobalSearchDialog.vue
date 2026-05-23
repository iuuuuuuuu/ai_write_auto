<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()

const visible = defineModel<boolean>('show', { default: false })

const keyword = ref('')
const searching = ref(false)
const results = ref<{
  chapters: Array<{ id: number; title: string; chapterNumber: number; novelId: number; snippet: string }>
  novels: Array<{ id: number; title: string; description: string | null }>
  characters: Array<{ id: number; name: string; description: string | null; novelId: number }>
} | null>(null)

const inputRef = ref<HTMLInputElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const totalResults = computed(() => {
  if (!results.value) return 0
  return results.value.chapters.length + results.value.novels.length + results.value.characters.length
})

watch(visible, (val) => {
  if (val) {
    nextTick(() => inputRef.value?.focus())
  } else {
    keyword.value = ''
    results.value = null
  }
})

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (keyword.value.trim().length < 2) {
    results.value = null
    return
  }
  debounceTimer = setTimeout(doSearch, 300)
}

async function doSearch() {
  const q = keyword.value.trim()
  if (q.length < 2) return
  searching.value = true
  try {
    results.value = await ($fetch as Function)('/api/search', { query: { q } })
  } catch {
    results.value = null
  } finally {
    searching.value = false
  }
}

function goToChapter(novelId: number, chapterId: number) {
  visible.value = false
  router.push(`/novels/${novelId}/chapters/${chapterId}`)
}

function goToNovel(novelId: number) {
  visible.value = false
  router.push(`/novels/${novelId}`)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    visible.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="search-overlay">
      <div
        v-if="visible"
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
        @keydown="onKeydown"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="visible = false"
        />
        <div class="relative w-full max-w-[560px] mx-4 animate-search-in">
          <div class="card-glass overflow-hidden rounded-2xl shadow-2xl">
            <!-- Search Input -->
            <div class="flex items-center gap-3 border-b border-(--ui-border)/40 px-4 py-3">
              <Icon
                icon="lucide:search"
                class="size-5 shrink-0 text-(--ui-text-dimmed)"
              />
              <input
                ref="inputRef"
                v-model="keyword"
                type="text"
                :placeholder="t('search.placeholder')"
                class="flex-1 bg-transparent text-sm text-(--ui-text) outline-none placeholder:text-(--ui-text-dimmed)"
                @input="onInput"
                @keydown.enter="doSearch"
              />
              <kbd class="hidden sm:inline-flex items-center gap-0.5 rounded-md bg-(--ui-bg-muted) px-1.5 py-0.5 text-[11px] font-medium text-(--ui-text-dimmed)">
                ESC
              </kbd>
            </div>

            <!-- Results -->
            <div class="max-h-[50vh] overflow-y-auto overscroll-contain">
              <!-- Loading -->
              <div
                v-if="searching"
                class="flex items-center justify-center py-8"
              >
                <Icon icon="lucide:loader-2" class="size-5 animate-spin text-(--ui-text-dimmed)" />
              </div>

              <!-- Empty state -->
              <div
                v-else-if="keyword.trim().length >= 2 && results && totalResults === 0"
                class="py-8 text-center text-sm text-(--ui-text-dimmed)"
              >
                {{ t('search.noResults') }}
              </div>

              <!-- Results list -->
              <template v-else-if="results && totalResults > 0">
                <!-- Novels -->
                <div v-if="results.novels.length > 0">
                  <p class="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-(--ui-text-dimmed)">
                    {{ t('search.novels') }}
                  </p>
                  <button
                    v-for="novel in results.novels"
                    :key="`n-${novel.id}`"
                    class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-(--ui-bg-muted)"
                    @click="goToNovel(novel.id)"
                  >
                    <Icon icon="lucide:book-open" class="size-4 shrink-0 text-primary-500" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-(--ui-text)">{{ novel.title }}</p>
                      <p v-if="novel.description" class="truncate text-xs text-(--ui-text-dimmed)">{{ novel.description }}</p>
                    </div>
                  </button>
                </div>

                <!-- Chapters -->
                <div v-if="results.chapters.length > 0">
                  <p class="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-(--ui-text-dimmed)">
                    {{ t('search.chapters') }}
                  </p>
                  <button
                    v-for="ch in results.chapters"
                    :key="`c-${ch.id}`"
                    class="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-(--ui-bg-muted)"
                    @click="goToChapter(ch.novelId, ch.id)"
                  >
                    <Icon icon="lucide:file-text" class="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-(--ui-text)">
                        第{{ ch.chapterNumber }}章 {{ ch.title }}
                      </p>
                      <p class="mt-0.5 line-clamp-2 text-xs text-(--ui-text-dimmed)">{{ ch.snippet }}</p>
                    </div>
                  </button>
                </div>

                <!-- Characters -->
                <div v-if="results.characters.length > 0">
                  <p class="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-(--ui-text-dimmed)">
                    {{ t('search.characters') }}
                  </p>
                  <button
                    v-for="char in results.characters"
                    :key="`ch-${char.id}`"
                    class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-(--ui-bg-muted)"
                    @click="goToNovel(char.novelId)"
                  >
                    <Icon icon="lucide:user" class="size-4 shrink-0 text-violet-500" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-(--ui-text)">{{ char.name }}</p>
                      <p v-if="char.description" class="truncate text-xs text-(--ui-text-dimmed)">{{ char.description }}</p>
                    </div>
                  </button>
                </div>
              </template>

              <!-- Hint -->
              <div
                v-else-if="!keyword.trim()"
                class="py-8 text-center text-sm text-(--ui-text-dimmed)"
              >
                {{ t('search.hint') }}
              </div>
            </div>

            <!-- Footer -->
            <div
              v-if="results && totalResults > 0"
              class="border-t border-(--ui-border)/40 px-4 py-2 text-center text-[11px] text-(--ui-text-dimmed)"
            >
              {{ totalResults }} {{ t('search.resultsFound') }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.search-overlay-enter-active {
  transition: opacity 0.2s ease;
}
.search-overlay-leave-active {
  transition: opacity 0.15s ease;
}
.search-overlay-enter-from,
.search-overlay-leave-to {
  opacity: 0;
}

@keyframes search-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.animate-search-in {
  animation: search-in 0.2s ease-out;
}
</style>

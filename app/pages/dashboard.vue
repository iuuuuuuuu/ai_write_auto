<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { user } = useAuth()
const { createNovel } = useNovels()
const router = useRouter()

interface NovelItem {
  id: number
  title: string
  description: string | null
  genre: string | null
  status: string
  wordCount: number | null
  createdAt: string
  updatedAt: string
}

const { data: stats } = await useFetch<{ todayWords: number; streak: number; totalNovels: number; totalWords: number }>('/api/stats/overview')
const { data: recentActivity } = await useFetch<Array<{
  id: number
  title: string
  chapterNumber: number
  novelId: number
  novelTitle: string
  updatedAt: string
  wordCount: number | null
}>>('/api/stats/recent-activity')

const {
  items: novels,
  loading: novelsLoading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  refresh: refreshNovels,
} = usePagination<NovelItem>({
  url: '/api/novels',
  pageSize: 12,
})

const showCreateModal = ref(false)
const newNovelTitle = ref('')
const newNovelDescription = ref('')
const newNovelGenre = ref<string | null>(null)
const creatingNovel = ref(false)

const genreOptions = [
  { label: t('novel.genres.fantasy'), value: 'fantasy' },
  { label: t('novel.genres.scifi'), value: 'scifi' },
  { label: t('novel.genres.romance'), value: 'romance' },
  { label: t('novel.genres.mystery'), value: 'mystery' },
  { label: t('novel.genres.horror'), value: 'horror' },
  { label: t('novel.genres.historical'), value: 'historical' },
  { label: t('novel.genres.urban'), value: 'urban' },
  { label: t('novel.genres.wuxia'), value: 'wuxia' },
  { label: t('novel.genres.other'), value: 'other' },
]

const genreColors: Record<string, { accent: string; bg: string }> = {
  fantasy: { accent: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/8' },
  scifi: { accent: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/8' },
  romance: { accent: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/8' },
  mystery: { accent: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/8' },
  horror: { accent: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/8' },
  historical: { accent: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-500/8' },
  urban: { accent: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/8' },
  wuxia: { accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8' },
  other: { accent: 'text-(--ui-text-muted)', bg: 'bg-(--ui-bg-muted)' },
}

function getGenreStyle(genre: string | null): { accent: string; bg: string } {
  return genreColors[genre || 'other'] || genreColors.other
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

async function handleCreateNovel() {
  if (!newNovelTitle.value.trim()) return
  creatingNovel.value = true
  try {
    const novel = await createNovel({
      title: newNovelTitle.value.trim(),
      description: newNovelDescription.value.trim() || undefined,
      genre: newNovelGenre.value || undefined,
    })
    showCreateModal.value = false
    newNovelTitle.value = ''
    newNovelDescription.value = ''
    newNovelGenre.value = null
    refreshNovels()
    router.push(`/novels/${novel.id}`)
  } finally {
    creatingNovel.value = false
  }
}

function getStatusLabel(status: string) {
  if (status === 'completed') return '已完结'
  if (status === 'in_progress') return '连载中'
  return '草稿'
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <!-- Greeting & Stats Banner -->
    <div class="mb-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-(--ui-text-highlighted) tracking-tight">
            {{ getGreeting() }}，{{ user?.username }}
          </h1>
          <p class="mt-1.5 text-sm text-(--ui-text-muted) leading-relaxed">
            <template v-if="stats?.todayWords">
              今天已写 <span class="font-medium text-(--ui-text)">{{ stats.todayWords }}</span> 字
              <template v-if="stats.streak > 1">
                · 连续创作 <span class="font-medium text-(--ui-text)">{{ stats.streak }}</span> 天
              </template>
            </template>
            <template v-else>
              今天还没有开始写作，来开始吧
            </template>
          </p>
        </div>
        <NButton type="primary" @click="showCreateModal = true" class="shrink-0">
          <template #icon>
            <Icon icon="lucide:plus" />
          </template>
          {{ t('novel.create') }}
        </NButton>
      </div>

      <!-- Compact stats row -->
      <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-(--ui-text-dimmed)">
        <span class="flex items-center gap-1.5">
          <Icon icon="lucide:book-open" class="w-3.5 h-3.5" />
          {{ stats?.totalNovels || 0 }} 部作品
        </span>
        <span class="flex items-center gap-1.5">
          <Icon icon="lucide:type" class="w-3.5 h-3.5" />
          {{ (stats?.totalWords || 0).toLocaleString() }} 总字数
        </span>
        <span v-if="stats?.streak" class="flex items-center gap-1.5">
          <Icon icon="lucide:flame" class="w-3.5 h-3.5 text-orange-500" />
          {{ stats.streak }} 天连续
        </span>
      </div>
    </div>

    <!-- Quick Resume: Recent Edits -->
    <section v-if="recentActivity?.length" class="mb-8">
      <h2 class="text-xs font-medium text-(--ui-text-dimmed) uppercase tracking-wider mb-3">继续写作</h2>
      <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <NuxtLink
          v-for="item in recentActivity"
          :key="item.id"
          :to="`/novels/${item.novelId}/chapters/${item.id}`"
          class="group flex-none w-52 p-3 rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-muted)/50 hover:bg-(--ui-bg-elevated) hover:border-(--ui-border) transition-all duration-200 hover:shadow-sm"
        >
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[11px] font-medium text-(--ui-text-dimmed) bg-(--ui-bg-elevated) px-1.5 py-0.5 rounded">
              第{{ item.chapterNumber }}章
            </span>
            <span class="text-[11px] text-(--ui-text-dimmed)">{{ formatRelativeTime(item.updatedAt) }}</span>
          </div>
          <p class="text-sm font-medium text-(--ui-text) truncate group-hover:text-(--ui-text-highlighted) transition-colors">
            {{ item.title }}
          </p>
          <p class="text-xs text-(--ui-text-dimmed) truncate mt-0.5">{{ item.novelTitle }}</p>
        </NuxtLink>
      </div>
    </section>

    <!-- Novels Grid -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-medium text-(--ui-text-dimmed) uppercase tracking-wider">我的作品</h2>
        <span v-if="total" class="text-xs text-(--ui-text-dimmed)">{{ total }} 部</span>
      </div>

      <!-- Loading -->
      <div v-if="novelsLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <NSkeleton v-for="i in 6" :key="i" class="h-36 rounded-xl" text />
      </div>

      <!-- Novel Cards -->
      <template v-else-if="novels.length">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <NuxtLink
            v-for="novel in novels"
            :key="novel.id"
            :to="`/novels/${novel.id}`"
            class="group relative p-4 rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-muted)/30 hover:bg-(--ui-bg-elevated) hover:border-(--ui-border) transition-all duration-200 hover:shadow-sm overflow-hidden"
          >
            <!-- Genre accent strip -->
            <div
              class="absolute top-0 left-0 w-full h-0.5 rounded-t-xl opacity-60 group-hover:opacity-100 transition-opacity"
              :class="getGenreStyle(novel.genre).bg"
              :style="{ background: novel.genre === 'fantasy' ? 'linear-gradient(90deg, #d97706, #f59e0b)' : novel.genre === 'scifi' ? 'linear-gradient(90deg, #0891b2, #06b6d4)' : novel.genre === 'romance' ? 'linear-gradient(90deg, #e11d48, #f43f5e)' : novel.genre === 'mystery' ? 'linear-gradient(90deg, #4f46e5, #6366f1)' : novel.genre === 'horror' ? 'linear-gradient(90deg, #dc2626, #ef4444)' : novel.genre === 'historical' ? 'linear-gradient(90deg, #c2410c, #ea580c)' : novel.genre === 'wuxia' ? 'linear-gradient(90deg, #059669, #10b981)' : novel.genre === 'urban' ? 'linear-gradient(90deg, #475569, #64748b)' : 'linear-gradient(90deg, var(--ui-border), var(--ui-border))' }"
            />

            <div class="flex items-start justify-between gap-2 mb-2">
              <h3 class="font-medium text-(--ui-text) group-hover:text-(--ui-text-highlighted) transition-colors truncate leading-snug">
                {{ novel.title }}
              </h3>
              <span
                class="shrink-0 text-[11px] px-1.5 py-0.5 rounded font-medium"
                :class="novel.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : novel.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-(--ui-bg-elevated) text-(--ui-text-dimmed)'"
              >
                {{ getStatusLabel(novel.status) }}
              </span>
            </div>

            <p v-if="novel.description" class="text-sm text-(--ui-text-dimmed) line-clamp-2 mb-3 leading-relaxed">
              {{ novel.description }}
            </p>
            <div v-else class="mb-3" />

            <div class="flex items-center justify-between text-xs text-(--ui-text-dimmed)">
              <span :class="getGenreStyle(novel.genre).accent" class="font-medium">
                {{ novel.genre ? t(`novel.genres.${novel.genre}`) : t('novel.genres.other') }}
              </span>
              <span>{{ (novel.wordCount || 0).toLocaleString() }} 字</span>
            </div>
          </NuxtLink>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-center pt-6">
          <NPagination
            :page="page"
            :page-count="totalPages"
            :page-size="pageSize"
            @update:page="goToPage"
          />
        </div>
      </template>

      <!-- Empty State -->
      <div v-else class="text-center py-20">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--ui-bg-muted) border border-(--ui-border)/60 mb-5">
          <Icon icon="lucide:feather" class="w-6 h-6 text-(--ui-text-dimmed)" />
        </div>
        <h3 class="text-base font-medium text-(--ui-text-highlighted)">开始你的第一个故事</h3>
        <p class="mt-1.5 text-sm text-(--ui-text-dimmed) max-w-xs mx-auto">创建一部小说，让 AI 帮助你构建世界、塑造角色、推进情节</p>
        <NButton class="mt-5" type="primary" @click="showCreateModal = true">
          <template #icon>
            <Icon icon="lucide:plus" />
          </template>
          {{ t('novel.create') }}
        </NButton>
      </div>
    </section>

    <!-- Create Novel Modal -->
    <NModal v-model:show="showCreateModal" preset="card" :title="t('novel.create')" style="max-width: 480px;">
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">{{ t('novel.novelTitle') }}</label>
          <NInput v-model:value="newNovelTitle" :placeholder="t('novel.novelTitle')" size="large" autofocus @keyup.enter="handleCreateNovel" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">{{ t('novel.description') }}</label>
          <NInput v-model:value="newNovelDescription" type="textarea" :placeholder="t('novel.description')" :rows="3" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">{{ t('novel.genre') }}</label>
          <NSelect v-model:value="newNovelGenre" :options="genreOptions" :placeholder="t('novel.genre')" clearable />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCreateModal = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="creatingNovel" :disabled="!newNovelTitle.trim()" @click="handleCreateNovel">{{ t('common.create') }}</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

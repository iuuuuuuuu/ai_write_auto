<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { user } = useAuth()
const { createNovel } = useNovels()
const router = useRouter()

interface NovelItem {
  id: number; title: string; description: string | null; genre: string | null
  status: string; wordCount: number | null; createdAt: string; updatedAt: string
}

const { data: stats } = await useFetch<{ todayWords: number; streak: number; totalNovels: number; totalWords: number }>('/api/stats/overview')
const { data: recentActivity } = await useFetch<Array<{
  id: number; title: string; chapterNumber: number; novelId: number; novelTitle: string; updatedAt: string; wordCount: number | null
}>>('/api/stats/recent-activity')

const { items: novels, loading: novelsLoading, page, total, totalPages, pageSize, goToPage, refresh: refreshNovels } = usePagination<NovelItem>({ url: '/api/novels', pageSize: 12 })

const showCreateModal = ref(false)
const newNovelTitle = ref('')
const newNovelDescription = ref('')
const newNovelGenre = ref<string | null>(null)
const creatingNovel = ref(false)
const staggerRef = ref<HTMLElement | null>(null)
useStaggerAnimation(staggerRef, { staggerDelay: 50 })

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

const genreColors: Record<string, string> = {
  fantasy: '#d97706', scifi: '#0891b2', romance: '#e11d48', mystery: '#4f46e5',
  horror: '#dc2626', historical: '#c2410c', wuxia: '#059669', urban: '#475569', other: '#94a3b8'
}

function getGenreColor(genre: string | null) {
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
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
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
  <div class="max-w-7xl mx-auto">
    <!-- Greeting & Stats -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <div>
        <h1 class="text-lg font-bold text-(--ui-text-highlighted) tracking-tight">
          {{ getGreeting() }}，<span class="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">{{ user?.username }}</span>
        </h1>
        <p class="mt-0.5 text-xs text-(--ui-text-muted)">
          <template v-if="stats?.todayWords">
            今日 <span class="font-semibold text-(--ui-text)">{{ stats.todayWords.toLocaleString() }}</span> 字
            <template v-if="stats.streak > 1"> · 连续 <span class="font-semibold text-(--ui-text)">{{ stats.streak }}</span> 天</template>
          </template>
          <template v-else>今天还没有开始写作</template>
        </p>
      </div>
      <NButton type="primary" size="small" class="shrink-0" @click="showCreateModal = true">
        <template #icon><Icon icon="lucide:plus" class="w-3.5 h-3.5" /></template>
        {{ t('novel.create') }}
      </NButton>
    </div>

    <!-- Compact Stats Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      <div class="card-surface p-2.5 flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background: linear-gradient(135deg, var(--ui-primary-300), var(--ui-primary-500));">
          <Icon icon="lucide:book-open" class="w-4 h-4 text-white" />
        </div>
        <div>
          <p class="text-lg font-bold font-mono text-(--ui-text) leading-none">{{ stats?.totalNovels || 0 }}</p>
          <p class="text-[10px] text-(--ui-text-dimmed) mt-0.5">部作品</p>
        </div>
      </div>
      <div class="card-surface p-2.5 flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background: linear-gradient(135deg, var(--ui-primary-300), var(--ui-primary-500));">
          <Icon icon="lucide:type" class="w-4 h-4 text-white" />
        </div>
        <div>
          <p class="text-lg font-bold font-mono text-(--ui-text) leading-none">{{ (stats?.totalWords || 0).toLocaleString() }}</p>
          <p class="text-[10px] text-(--ui-text-dimmed) mt-0.5">总字数</p>
        </div>
      </div>
      <div class="card-surface p-2.5 flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
          <Icon icon="lucide:flame" class="w-4 h-4 text-white" />
        </div>
        <div>
          <p class="text-lg font-bold font-mono text-(--ui-text) leading-none">{{ stats?.streak || 0 }}</p>
          <p class="text-[10px] text-(--ui-text-dimmed) mt-0.5">天连续</p>
        </div>
      </div>
      <div class="card-surface p-2.5 flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background: linear-gradient(135deg, var(--ui-primary-300), var(--ui-primary-500));">
          <Icon icon="lucide:pencil" class="w-4 h-4 text-white" />
        </div>
        <div>
          <p class="text-lg font-bold font-mono text-(--ui-text) leading-none">{{ stats?.todayWords || 0 }}</p>
          <p class="text-[10px] text-(--ui-text-dimmed) mt-0.5">今日</p>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <section v-if="recentActivity?.length" class="mb-4">
      <h2 class="text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider mb-2">继续写作</h2>
      <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <NuxtLink
          v-for="item in recentActivity"
          :key="item.id"
          :to="`/novels/${item.novelId}/chapters/${item.id}`"
          class="group flex-none w-48 p-2.5 card-surface hover:border-(--ui-border-accented) transition-all duration-200"
        >
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-[10px] font-semibold text-(--ui-text-dimmed) bg-(--ui-bg-muted) px-1.5 py-0.5 rounded">第{{ item.chapterNumber }}章</span>
            <span class="text-[10px] text-(--ui-text-dimmed)">{{ formatRelativeTime(item.updatedAt) }}</span>
          </div>
          <p class="text-[13px] font-medium text-(--ui-text) truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{{ item.title }}</p>
          <p class="text-[11px] text-(--ui-text-dimmed) truncate mt-0.5">{{ item.novelTitle }}</p>
        </NuxtLink>
      </div>
    </section>

    <!-- Novels Grid -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider">我的作品</h2>
        <span v-if="total" class="text-[11px] text-(--ui-text-dimmed)">{{ total }} 部</span>
      </div>

      <div v-if="novelsLoading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        <NSkeleton v-for="i in 6" :key="i" class="h-28 rounded-lg" text />
      </div>

      <template v-else-if="novels.length">
        <div ref="staggerRef" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          <NuxtLink
            v-for="novel in novels"
            :key="novel.id"
            :to="`/novels/${novel.id}`"
            class="group card-surface p-3 hover:border-(--ui-border-accented) transition-all duration-200 overflow-hidden relative"
          >
            <div class="absolute top-0 left-0 w-full h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
                 :style="{ background: `linear-gradient(90deg, ${getGenreColor(novel.genre)}aa, ${getGenreColor(novel.genre)})` }" />
            <div class="flex items-start justify-between gap-1.5 mb-1.5">
              <h3 class="text-[13px] font-semibold text-(--ui-text) group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate leading-snug">{{ novel.title }}</h3>
              <span class="shrink-0 text-[10px] px-1 py-0.5 rounded font-medium"
                    :class="novel.status === 'completed' ? 'bg-emerald-500/8 text-emerald-600' : novel.status === 'in_progress' ? 'bg-blue-500/8 text-blue-600' : 'bg-(--ui-bg-muted) text-(--ui-text-dimmed)'">
                {{ getStatusLabel(novel.status) }}
              </span>
            </div>
            <p v-if="novel.description" class="text-[11px] text-(--ui-text-dimmed) line-clamp-2 mb-2 leading-relaxed">{{ novel.description }}</p>
            <div v-else class="mb-2" />
            <div class="flex items-center justify-between text-[10px] text-(--ui-text-dimmed)">
              <span class="font-medium" :style="{ color: getGenreColor(novel.genre) }">{{ novel.genre ? t(`novel.genres.${novel.genre}`) : t('novel.genres.other') }}</span>
              <span class="font-mono">{{ (novel.wordCount || 0).toLocaleString() }} 字</span>
            </div>
          </NuxtLink>
        </div>
        <div v-if="totalPages > 1" class="flex items-center justify-center pt-3">
          <NPagination :page="page" :page-count="totalPages" :page-size="pageSize" @update:page="goToPage" />
        </div>
      </template>

      <div v-else class="py-16">
        <EmptyState
          icon="lucide:feather"
          title="开始你的第一个故事"
          description="创建一部小说，让 AI 帮助你构建世界、塑造角色、推进情节"
          :action-label="t('novel.create')"
          @action="showCreateModal = true"
        />
      </div>
    </section>

    <!-- Create Modal -->
    <NModal v-model:show="showCreateModal" preset="card" :title="t('novel.create')" style="max-width: 440px;">
      <div class="space-y-3">
        <div class="space-y-1">
          <label class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">{{ t('novel.novelTitle') }}</label>
          <NInput v-model:value="newNovelTitle" :placeholder="t('novel.novelTitle')" size="large" autofocus @keyup.enter="handleCreateNovel" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">{{ t('novel.description') }}</label>
          <NInput v-model:value="newNovelDescription" type="textarea" :placeholder="t('novel.description')" :rows="3" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">{{ t('novel.genre') }}</label>
          <NSelect v-model:value="newNovelGenre" :options="genreOptions" :placeholder="t('novel.genre')" clearable />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showCreateModal = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" size="small" :loading="creatingNovel" :disabled="!newNovelTitle.trim()" @click="handleCreateNovel">{{ t('common.create') }}</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
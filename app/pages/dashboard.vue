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

const { data: stats } = await useFetch<{ todayWords: number; dailyGoal: number; dailyProgress: number; chapterGoal: number; streak: number; totalNovels: number; totalWords: number }>('/api/stats/overview')
const { data: recentActivity } = await useFetch<Array<{
  id: number; title: string; chapterNumber: number; novelId: number; novelTitle: string; updatedAt: string; wordCount: number | null
}>>('/api/stats/recent-activity')

const { items: novels, loading: novelsLoading, page, total, totalPages, pageSize, goToPage, refresh: refreshNovels } = usePagination<NovelItem>({ url: '/api/novels', pageSize: 12 })

const showCreateModal = ref(false)
const newNovelTitle = ref('')
const newNovelDescription = ref('')
const newNovelGenre = ref<string | null>(null)
const newNovelWorldSetting = ref('')
const newNovelStyleGuide = ref('')
const creatingNovel = ref(false)
const generatingWorldbuilding = ref(false)
const creatingSampleNovel = ref(false)
const showOnboardingTips = ref(false)
const staggerRef = ref<HTMLElement | null>(null)
useStaggerAnimation(staggerRef, { staggerDelay: 50 })

const { steps, currentStep, showOnboarding, nextStep, complete } =
  useOnboarding()

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
  fantasy: '#d97706',
  scifi: '#0891b2',
  romance: '#e11d48',
  mystery: '#4f46e5',
  horror: '#dc2626',
  historical: '#c2410c',
  wuxia: '#059669',
  urban: '#475569',
  other: '#94a3b8'
}

const sampleNovelOutlines = [
  { chapterNumber: 1, description: '主角在废弃观测站醒来，发现天空中多出一轮陌生的蓝色月亮。', sortOrder: 0 },
  { chapterNumber: 2, description: '旧城档案揭示蓝月每隔百年出现一次，并会带走所有未完成的愿望。', sortOrder: 1 },
  { chapterNumber: 3, description: '主角组建临时小队，决定在蓝月落下前修复观测站的星轨仪。', sortOrder: 2 },
]

const sampleChapterContent = `蓝月升起的时候，林澈正躺在观测站冰冷的地板上。\n\n他记得自己昨夜只是来取一份旧地图，却在睁眼后看见穹顶裂缝外悬着第二个月亮。那轮月亮泛着不真实的蓝光，像一枚被遗忘在夜空里的眼睛。\n\n控制台仍在发出微弱的电流声。屏幕上只有一行字反复闪烁：星轨偏移，愿望回收倒计时开始。`

async function createSampleNovel() {
  if (creatingSampleNovel.value) return
  creatingSampleNovel.value = true
  try {
    const novel = await createNovel({
      title: '蓝月观测站',
      description: '一部关于愿望、星轨与旧城秘密的示例小说，可用于快速体验大纲、章节与 AI 写作流程。',
      genre: 'scifi',
      worldSetting: '近未来旧城，百年一现的蓝月会回收人类未完成的愿望。废弃观测站保存着修正星轨的唯一线索。',
      styleGuide: '悬疑感、画面感、短段落推进，语言克制但保留诗意。'
    })
    await Promise.all([
      $fetch(`/api/novels/${novel.id}/chapters`, {
        method: 'POST',
        body: {
          title: '蓝月升起',
          chapterNumber: 1,
          content: sampleChapterContent
        }
      }),
      $fetch(`/api/novels/${novel.id}/outlines`, {
        method: 'PUT',
        body: { outlines: sampleNovelOutlines }
      })
    ])
    await refreshNovels()
    router.push(`/novels/${novel.id}`)
  } finally {
    creatingSampleNovel.value = false
  }
}

function closeOnboardingTips() {
  showOnboardingTips.value = false
  try {
    localStorage.setItem('dashboard_onboarding_tips_closed', '1')
  } catch {
    // localStorage 可能不可用
  }
}

onMounted(() => {
  try {
    showOnboardingTips.value = localStorage.getItem('dashboard_onboarding_tips_closed') !== '1'
  } catch {
    showOnboardingTips.value = true
  }
})

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
      worldSetting: newNovelWorldSetting.value.trim() || undefined,
      styleGuide: newNovelStyleGuide.value.trim() || undefined,
    })
    showCreateModal.value = false
    newNovelTitle.value = ''
    newNovelDescription.value = ''
    newNovelGenre.value = null
    newNovelWorldSetting.value = ''
    newNovelStyleGuide.value = ''
    refreshNovels()
    router.push(`/novels/${novel.id}`)
  } finally {
    creatingNovel.value = false
  }
}

async function generateWorldbuilding() {
  const title = newNovelTitle.value.trim()
  if (!title) return
  generatingWorldbuilding.value = true
  try {
    const result = await $fetch<{ worldSetting: string; styleGuide: string }>('/api/ai/worldbuilding', {
      method: 'POST',
      body: {
        title,
        description: newNovelDescription.value.trim() || undefined,
        genre: newNovelGenre.value || undefined
      }
    })
    if (result.worldSetting) newNovelWorldSetting.value = result.worldSetting
    if (result.styleGuide) newNovelStyleGuide.value = result.styleGuide
  } catch {
    message.error('生成设定失败，请稍后重试')
  } finally {
    generatingWorldbuilding.value = false
  }
}

function getStatusLabel(status: string) {
  if (status === 'completed') return '已完结'
  if (status === 'in_progress') return '连载中'
  return '草稿'
}

/* ─────────────── 导入小说 ─────────────── */
const showImportModal = ref(false)
const importTitle = ref('')
const importFile = ref<File | null>(null)
const importFormat = ref<'txt' | 'md'>('txt')
const importLoading = ref(false)
const importPreview = ref<Array<{ title: string; content: string }>>([])
const importStep = ref<'upload' | 'preview'>('upload')

const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千\d]+章\s*/,
  /^Chapter\s+\d+/i,
  /^#{1,2}\s+第[一二三四五六七八九十百千\d]+章/,
  /^#{1,2}\s+Chapter\s+\d+/i,
]

function splitIntoChapters(content: string): Array<{ title: string; content: string }> {
  const lines = content.split('\n')
  const chapters: Array<{ title: string; content: string }> = []
  let currentTitle = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const isChapterHeading = CHAPTER_PATTERNS.some(p => p.test(line.trim()))
    if (isChapterHeading) {
      if (currentTitle || currentContent.length > 0) {
        chapters.push({
          title: currentTitle || `章节 ${chapters.length + 1}`,
          content: currentContent.join('\n').trim(),
        })
      }
      currentTitle = line.trim().replace(/^#{1,2}\s+/, '').replace(/^[-=]+$/, '').trim()
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  if (currentTitle || currentContent.length > 0) {
    chapters.push({
      title: currentTitle || `章节 ${chapters.length + 1}`,
      content: currentContent.join('\n').trim(),
    })
  }

  if (chapters.length === 0) {
    chapters.push({ title: '第1章', content: content.trim() })
  }

  return chapters
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') importFormat.value = 'md'
  else if (ext === 'txt') importFormat.value = 'txt'
  else {
    message.error('仅支持 .txt 和 .md 文件')
    return
  }

  importFile.value = file
  const text = await file.text()
  importPreview.value = splitIntoChapters(text)

  if (!importTitle.value.trim()) {
    importTitle.value = file.name.replace(/\.[^.]+$/, '')
  }

  importStep.value = 'preview'
}

function removeImportChapter(index: number) {
  importPreview.value.splice(index, 1)
}

function moveImportChapter(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= importPreview.value.length) return
  const temp = importPreview.value[index]
  importPreview.value[index] = importPreview.value[newIndex]
  importPreview.value[newIndex] = temp
}

async function confirmImport() {
  if (!importTitle.value.trim()) {
    message.warning('请输入小说标题')
    return
  }
  if (importPreview.value.length === 0) {
    message.warning('没有可导入的章节')
    return
  }

  importLoading.value = true
  try {
    const content = importPreview.value.map(ch => `${ch.title}\n\n${ch.content}`).join('\n\n')
    const result = await $fetch<{ novelId: number; chaptersImported: number }>('/api/novels/import', {
      method: 'POST',
      body: {
        title: importTitle.value.trim(),
        content,
        format: importFormat.value
      }
    })
    message.success(`成功导入 ${result.chaptersImported} 个章节`)
    showImportModal.value = false
    importTitle.value = ''
    importFile.value = null
    importPreview.value = []
    importStep.value = 'upload'
    await refreshNovels()
    router.push(`/novels/${result.novelId}`)
  } catch (e: any) {
    message.error(e?.data?.message || '导入失败')
  } finally {
    importLoading.value = false
  }
}

function resetImport() {
  importStep.value = 'upload'
  importFile.value = null
  importPreview.value = []
  importTitle.value = ''
}
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <OnboardingTooltip
      :steps="steps"
      :current-step="currentStep"
      :show="showOnboarding"
      @next="nextStep"
      @complete="complete"
      @skip="complete"
    />

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
      <div class="flex shrink-0 gap-2">
        <NButton size="small" @click="showImportModal = true">
          <template #icon><Icon icon="lucide:upload" class="w-3.5 h-3.5" /></template>
          导入
        </NButton>
        <NButton type="primary" size="small" @click="showCreateModal = true">
          <template #icon><Icon icon="lucide:plus" class="w-3.5 h-3.5" /></template>
          {{ t('novel.create') }}
        </NButton>
      </div>
    </div>

    <!-- Onboarding Tips -->
    <section
      v-if="showOnboardingTips"
      class="mb-4 rounded-xl border border-(--ui-border)/60 bg-(--ui-bg-muted)/35 p-3"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <Icon
              icon="lucide:map"
              class="size-4 text-primary-500"
            />
            <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">新手写作路径</h2>
          </div>
          <div class="mt-3 grid gap-2 text-xs text-(--ui-text-muted) md:grid-cols-4">
            <div class="rounded-lg bg-(--ui-bg)/60 p-2">
              <p class="font-medium text-(--ui-text)">1. 创建作品</p>
              <p class="mt-1">先填写标题、类型和一句故事简介。</p>
            </div>
            <div class="rounded-lg bg-(--ui-bg)/60 p-2">
              <p class="font-medium text-(--ui-text)">2. 补充设定</p>
              <p class="mt-1">在详细设定中写下世界观和写作风格。</p>
            </div>
            <div class="rounded-lg bg-(--ui-bg)/60 p-2">
              <p class="font-medium text-(--ui-text)">3. 规划大纲</p>
              <p class="mt-1">进入作品详情后编辑或 AI 生成章节大纲。</p>
            </div>
            <div class="rounded-lg bg-(--ui-bg)/60 p-2">
              <p class="font-medium text-(--ui-text)">4. 开始写作</p>
              <p class="mt-1">打开章节，使用保存、续写和扩写快捷键。</p>
            </div>
          </div>
        </div>
        <NButton
          size="tiny"
          quaternary
          @click="closeOnboardingTips"
        >
          知道了
        </NButton>
      </div>
    </section>

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

    <section v-if="stats?.dailyGoal" class="card-surface p-3 mb-4">
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="flex items-center gap-2">
          <Icon icon="lucide:target" class="size-4 text-primary-500" />
          <span class="text-xs font-medium text-(--ui-text)">今日写作目标</span>
        </div>
        <span class="text-xs font-mono text-(--ui-text-muted)">
          {{ (stats.todayWords || 0).toLocaleString() }} / {{ stats.dailyGoal.toLocaleString() }} 字
        </span>
      </div>
      <NProgress
        type="line"
        :percentage="stats.dailyProgress || 0"
        :height="8"
        :show-indicator="false"
      />
    </section>

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

    <!-- Reading History -->
    <ReadingHistory class="mb-4" />

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
        <div class="-mt-6 flex justify-center">
          <NButton
            size="small"
            secondary
            :loading="creatingSampleNovel"
            @click="createSampleNovel"
          >
            <template #icon>
              <Icon icon="lucide:sparkles" />
            </template>
            生成示例小说
          </NButton>
        </div>
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
        <NCollapse>
          <NCollapseItem title="详细设定（可选）" name="advanced">
            <div class="space-y-3 pt-1">
              <NButton
                size="tiny"
                secondary
                :loading="generatingWorldbuilding"
                :disabled="!newNovelTitle.trim()"
                @click="generateWorldbuilding"
              >
                <template #icon><Icon icon="lucide:sparkles" /></template>
                AI 生成设定
              </NButton>
              <div class="space-y-1">
                <label class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">世界观</label>
                <NInput
                  v-model:value="newNovelWorldSetting"
                  type="textarea"
                  placeholder="时代背景、地理环境、势力格局、核心规则等"
                  :rows="4"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">写作风格</label>
                <NInput
                  v-model:value="newNovelStyleGuide"
                  type="textarea"
                  placeholder="叙事口吻、节奏、语言风格、禁用表达等"
                  :rows="3"
                />
              </div>
            </div>
          </NCollapseItem>
        </NCollapse>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showCreateModal = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" size="small" :loading="creatingNovel" :disabled="!newNovelTitle.trim()" @click="handleCreateNovel">{{ t('common.create') }}</NButton>
        </div>
      </template>
    </NModal>

    <!-- Import Modal -->
    <NModal v-model:show="showImportModal" preset="card" title="导入小说" style="max-width: 560px;" @after-leave="resetImport">
      <div v-if="importStep === 'upload'" class="space-y-4">
        <div class="space-y-1">
          <label class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">小说标题</label>
          <NInput v-model:value="importTitle" placeholder="导入后的小说标题" size="large" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">上传文件</label>
          <div
            class="rounded-lg border-2 border-dashed border-(--ui-border)/40 p-8 text-center transition-colors hover:border-(--ui-border)/70 cursor-pointer"
            @click="$refs.fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".txt,.md"
              class="hidden"
              @change="handleFileSelect"
            />
            <Icon icon="lucide:upload-cloud" class="mx-auto mb-2 size-8 text-(--ui-text-dimmed)" />
            <p class="text-sm text-(--ui-text-muted)">点击上传 .txt 或 .md 文件</p>
            <p class="mt-1 text-xs text-(--ui-text-dimmed)">支持按「第X章」或「Chapter X」自动分割章节</p>
          </div>
        </div>
      </div>

      <div v-else-if="importStep === 'preview'" class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-(--ui-text-highlighted)">{{ importTitle || '未命名' }}</p>
            <p class="text-xs text-(--ui-text-dimmed)">共 {{ importPreview.length }} 个章节 · {{ importFormat.toUpperCase() }}</p>
          </div>
          <NButton size="tiny" quaternary @click="resetImport">
            <template #icon><Icon icon="lucide:upload" class="size-3" /></template>
            重新上传
          </NButton>
        </div>
        <div class="max-h-80 overflow-y-auto space-y-2 pr-1">
          <div
            v-for="(ch, idx) in importPreview"
            :key="idx"
            class="rounded-md border border-(--ui-border)/20 bg-(--ui-bg-muted)/30 p-2.5"
          >
            <div class="flex items-center justify-between gap-2 mb-1">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-[10px] text-(--ui-text-dimmed) shrink-0">#{{ idx + 1 }}</span>
                <NInput v-model:value="ch.title" size="tiny" class="min-w-0" placeholder="章节标题" />
              </div>
              <div class="flex shrink-0 gap-0.5">
                <button
                  class="flex size-6 items-center justify-center rounded text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated) hover:text-(--ui-text) disabled:opacity-30"
                  :disabled="idx === 0"
                  @click="moveImportChapter(idx, -1)"
                >
                  <Icon icon="lucide:chevron-up" class="size-3.5" />
                </button>
                <button
                  class="flex size-6 items-center justify-center rounded text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated) hover:text-(--ui-text) disabled:opacity-30"
                  :disabled="idx === importPreview.length - 1"
                  @click="moveImportChapter(idx, 1)"
                >
                  <Icon icon="lucide:chevron-down" class="size-3.5" />
                </button>
                <button
                  class="flex size-6 items-center justify-center rounded text-(--ui-text-dimmed) hover:bg-red-500/10 hover:text-red-500"
                  @click="removeImportChapter(idx)"
                >
                  <Icon icon="lucide:x" class="size-3.5" />
                </button>
              </div>
            </div>
            <p class="text-[11px] text-(--ui-text-dimmed) line-clamp-2">
              {{ ch.content.slice(0, 120) }}{{ ch.content.length > 120 ? '...' : '' }}
            </p>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showImportModal = false">{{ t('common.cancel') }}</NButton>
          <NButton
            v-if="importStep === 'preview'"
            type="primary"
            size="small"
            :loading="importLoading"
            :disabled="!importTitle.trim() || importPreview.length === 0"
            @click="confirmImport"
          >
            <template #icon><Icon icon="lucide:download" /></template>
            确认导入
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

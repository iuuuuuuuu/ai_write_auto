<script setup lang="ts">
import {
  getNovelGenreColor,
  getNovelGenreLabelKey
} from '~~/shared/novel-catalog'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { user } = useAuth()
const { createNovel } = useNovels()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const { post, put, del: apiDel } = useApi()
const fileInput = ref<HTMLInputElement | null>(null)
const NuxtLinkComponent = resolveComponent('NuxtLink')

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

const { data: stats } = await useFetch<{
  todayWords: number
  dailyGoal: number
  dailyProgress: number
  chapterGoal: number
  streak: number
  totalNovels: number
  totalWords: number
}>('/api/stats/overview')
const { data: recentActivity } = await useFetch<
  Array<{
    id: number
    title: string
    chapterNumber: number
    novelId: number
    novelTitle: string
    updatedAt: string
    wordCount: number | null
  }>
>('/api/stats/recent-activity')

const {
  items: novels,
  loading: novelsLoading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  refresh: refreshNovels
} = usePagination<NovelItem>({ url: '/api/novels', pageSize: 12 })

/* ─────────────── 批量删除小说 ─────────────── */
const selectionMode = ref(false)
const selectedNovelIds = ref<number[]>([])

function toggleNovelSelectionMode() {
  selectionMode.value = !selectionMode.value
  selectedNovelIds.value = []
}
function toggleNovelSelection(id: number) {
  const i = selectedNovelIds.value.indexOf(id)
  if (i >= 0) selectedNovelIds.value.splice(i, 1)
  else selectedNovelIds.value.push(id)
}
const allNovelsSelected = computed(
  () =>
    novels.value.length > 0 &&
    selectedNovelIds.value.length === novels.value.length
)
function toggleSelectAllNovels() {
  selectedNovelIds.value =
    allNovelsSelected.value ? [] : novels.value.map((n) => n.id)
}
function confirmBatchDeleteNovels() {
  if (!selectedNovelIds.value.length) return
  dialog.warning({
    title: '批量删除小说',
    content: `确定要删除选中的 ${selectedNovelIds.value.length} 部小说吗？删除后可在回收站恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      const ids = [...selectedNovelIds.value]
      await Promise.all(
        ids.map((id) =>
          apiDel(`/api/novels/${id}`, { silent: true }).catch(() => {})
        )
      )
      message.success(`已删除 ${ids.length} 部小说`)
      selectionMode.value = false
      selectedNovelIds.value = []
      await refreshNovels()
    }
  })
}

const showCreateModal = shallowRef(false)
const creatingSampleNovel = shallowRef(false)
const showOnboardingTips = shallowRef(false)
const staggerRef = ref<HTMLElement | null>(null)
useStaggerAnimation(staggerRef, { staggerDelay: 50 })

const sampleNovelOutlines = [
  {
    chapterNumber: 1,
    description: '主角在废弃观测站醒来，发现天空中多出一轮陌生的蓝色月亮。',
    sortOrder: 0
  },
  {
    chapterNumber: 2,
    description: '旧城档案揭示蓝月每隔百年出现一次，并会带走所有未完成的愿望。',
    sortOrder: 1
  },
  {
    chapterNumber: 3,
    description: '主角组建临时小队，决定在蓝月落下前修复观测站的星轨仪。',
    sortOrder: 2
  }
]

const sampleChapterContent = `蓝月升起的时候，林澈正躺在观测站冰冷的地板上。\n\n他记得自己昨夜只是来取一份旧地图，却在睁眼后看见穹顶裂缝外悬着第二个月亮。那轮月亮泛着不真实的蓝光，像一枚被遗忘在夜空里的眼睛。\n\n控制台仍在发出微弱的电流声。屏幕上只有一行字反复闪烁：星轨偏移，愿望回收倒计时开始。`

async function createSampleNovel() {
  if (creatingSampleNovel.value) return
  creatingSampleNovel.value = true
  try {
    const novel = await createNovel({
      title: '蓝月观测站',
      description:
        '一部关于愿望、星轨与旧城秘密的示例小说，可用于快速体验大纲、章节与 AI 写作流程。',
      genre: 'scifi',
      worldSetting:
        '近未来旧城，百年一现的蓝月会回收人类未完成的愿望。废弃观测站保存着修正星轨的唯一线索。',
      styleGuide: '悬疑感、画面感、短段落推进，语言克制但保留诗意。'
    })
    await Promise.all([
      post(`/api/novels/${novel.id}/chapters`, {
        title: '蓝月升起',
        chapterNumber: 1,
        content: sampleChapterContent
      }),
      put(`/api/novels/${novel.id}/outlines`, { outlines: sampleNovelOutlines })
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
    showOnboardingTips.value =
      localStorage.getItem('dashboard_onboarding_tips_closed') !== '1'
  } catch {
    showOnboardingTips.value = true
  }
})

function getGenreColor(genre: string | null) {
  return getNovelGenreColor(genre)
}

function getGenreLabel(genre: string | null) {
  return t(getNovelGenreLabelKey(genre))
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
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

async function handleNovelCreated(novel: NovelItem) {
  await refreshNovels()
  router.push(`/novels/${novel.id}`)
}

function getStatusLabel(status: string) {
  if (status === 'completed') return '已完结'
  if (status === 'in_progress') return '连载中'
  return '草稿'
}

/* ─────────────── 导入小说 ─────────────── */
const showImportModal = shallowRef(false)
const importTitle = shallowRef('')
const importFile = shallowRef<File | null>(null)
const importFormat = shallowRef<'txt' | 'md'>('txt')
const importLoading = shallowRef(false)
const importPreview = ref<Array<{ title: string; content: string }>>([])
const importStep = shallowRef<'upload' | 'preview'>('upload')

const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千\d]+章\s*/,
  /^Chapter\s+\d+/i,
  /^#{1,2}\s+第[一二三四五六七八九十百千\d]+章/,
  /^#{1,2}\s+Chapter\s+\d+/i
]

function splitIntoChapters(
  content: string
): Array<{ title: string; content: string }> {
  const lines = content.split('\n')
  const chapters: Array<{ title: string; content: string }> = []
  let currentTitle = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const isChapterHeading = CHAPTER_PATTERNS.some((p) => p.test(line.trim()))
    if (isChapterHeading) {
      if (currentTitle || currentContent.length > 0) {
        chapters.push({
          title: currentTitle || `章节 ${chapters.length + 1}`,
          content: currentContent.join('\n').trim()
        })
      }
      currentTitle = line
        .trim()
        .replace(/^#{1,2}\s+/, '')
        .replace(/^[-=]+$/, '')
        .trim()
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  if (currentTitle || currentContent.length > 0) {
    chapters.push({
      title: currentTitle || `章节 ${chapters.length + 1}`,
      content: currentContent.join('\n').trim()
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
  const arr = importPreview.value
  ;[arr[index], arr[newIndex]] = [
    arr[newIndex] as (typeof arr)[0],
    arr[index] as (typeof arr)[0]
  ]
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
    const content = importPreview.value
      .map((ch) => `${ch.title}\n\n${ch.content}`)
      .join('\n\n')
    const result = await post<{ novelId: number; chaptersImported: number }>(
      '/api/novels/import',
      {
        title: importTitle.value.trim(),
        content,
        format: importFormat.value
      },
      { successMessage: `成功导入 ${importPreview.value.length} 个章节` }
    )
    showImportModal.value = false
    importTitle.value = ''
    importFile.value = null
    importPreview.value = []
    importStep.value = 'upload'
    await refreshNovels()
    router.push(`/novels/${result.novelId}`)
  } catch {
    // useApi handles error display
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
  <div class="mx-auto max-w-[1500px] space-y-4">
    <!-- Greeting & Stats -->
    <section
      class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]"
    >
      <div
        class="card-glass flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[2rem] p-5 md:p-7"
      >
        <div class="max-w-3xl">
          <p
            class="mb-2 text-xs uppercase tracking-[0.24em] text-(--ui-text-dimmed)"
          >
            Writing Command Center
          </p>
          <h1
            class="text-3xl font-medium tracking-normal text-(--ui-text-highlighted) md:text-5xl"
          >
            {{ getGreeting() }}，<span
              class="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent"
              >{{ user?.username }}</span
            >
          </h1>
          <p class="mt-3 text-sm leading-6 text-(--ui-text-muted)">
            <template v-if="stats?.todayWords">
              今日已写
              <span class="font-medium text-(--ui-text)">{{
                stats.todayWords.toLocaleString()
              }}</span>
              字
              <template v-if="stats.streak > 1">
                · 连续
                <span class="font-medium text-(--ui-text)">{{
                  stats.streak
                }}</span>
                天保持创作节奏</template
              >
            </template>
            <template v-else
              >今天还没有开始写作，先创建作品或继续最近章节。</template
            >
          </p>
        </div>
        <div class="mt-8 flex flex-wrap gap-2">
          <NButton
            size="medium"
            round
            @click="showImportModal = true"
          >
            <template #icon
              ><Icon
                icon="lucide:upload"
                class="h-4 w-4"
            /></template>
            导入
          </NButton>
          <NButton
            type="primary"
            size="medium"
            round
            @click="showCreateModal = true"
          >
            <template #icon
              ><Icon
                icon="lucide:plus"
                class="h-4 w-4"
            /></template>
            {{ t('novel.create') }}
          </NButton>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div class="grid grid-cols-2 gap-3">
          <div class="liquid-panel flex items-center gap-3 p-3.5">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-500"
            >
              <Icon
                icon="lucide:book-open"
                class="h-5 w-5 text-white"
              />
            </div>
            <div class="min-w-0">
              <p
                class="font-mono text-xl font-medium leading-none text-(--ui-text)"
              >
                {{ stats?.totalNovels || 0 }}
              </p>
              <p class="mt-1 text-[11px] text-(--ui-text-dimmed)">部作品</p>
            </div>
          </div>
          <div class="liquid-panel flex items-center gap-3 p-3.5">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-500"
            >
              <Icon
                icon="lucide:type"
                class="h-5 w-5 text-white"
              />
            </div>
            <div class="min-w-0">
              <p
                class="truncate font-mono text-xl font-medium leading-none text-(--ui-text)"
              >
                {{ (stats?.totalWords || 0).toLocaleString() }}
              </p>
              <p class="mt-1 text-[11px] text-(--ui-text-dimmed)">总字数</p>
            </div>
          </div>
          <div class="liquid-panel flex items-center gap-3 p-3.5">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500"
            >
              <Icon
                icon="lucide:flame"
                class="h-5 w-5 text-white"
              />
            </div>
            <div class="min-w-0">
              <p
                class="font-mono text-xl font-medium leading-none text-(--ui-text)"
              >
                {{ stats?.streak || 0 }}
              </p>
              <p class="mt-1 text-[11px] text-(--ui-text-dimmed)">天连续</p>
            </div>
          </div>
          <div class="liquid-panel flex items-center gap-3 p-3.5">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-500"
            >
              <Icon
                icon="lucide:pencil"
                class="h-5 w-5 text-white"
              />
            </div>
            <div class="min-w-0">
              <p
                class="truncate font-mono text-xl font-medium leading-none text-(--ui-text)"
              >
                {{ (stats?.todayWords || 0).toLocaleString() }}
              </p>
              <p class="mt-1 text-[11px] text-(--ui-text-dimmed)">今日</p>
            </div>
          </div>
        </div>

        <section
          v-if="stats?.dailyGoal"
          class="liquid-panel flex flex-col justify-between p-4"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/12 text-primary-500"
              >
                <Icon
                  icon="lucide:target"
                  class="size-4"
                />
              </span>
              <span class="text-sm font-medium text-(--ui-text)"
                >今日写作目标</span
              >
            </div>
            <span class="font-mono text-xs text-(--ui-text-muted)">
              {{ (stats.todayWords || 0).toLocaleString() }} /
              {{ stats.dailyGoal.toLocaleString() }} 字
            </span>
          </div>
          <NProgress
            type="line"
            :percentage="stats.dailyProgress || 0"
            :height="8"
            :show-indicator="false"
          />
        </section>
      </div>
    </section>

    <!-- Onboarding Tips -->
    <section
      v-if="showOnboardingTips"
      class="liquid-panel p-4"
    >
      <div
        class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/12 text-primary-500"
            >
              <Icon
                icon="lucide:map"
                class="size-4"
              />
            </span>
            <h2 class="text-sm font-medium text-(--ui-text-highlighted)">
              新手写作路径
            </h2>
          </div>
          <div
            class="mt-4 grid gap-2 text-xs text-(--ui-text-muted) md:grid-cols-4"
          >
            <div class="rounded-2xl bg-(--ui-bg-muted) p-3">
              <p class="font-medium text-(--ui-text)">1. 创建作品</p>
              <p class="mt-1">先填写标题、类型和一句故事简介。</p>
            </div>
            <div class="rounded-2xl bg-(--ui-bg-muted) p-3">
              <p class="font-medium text-(--ui-text)">2. 补充设定</p>
              <p class="mt-1">在详细设定中写下世界观和写作风格。</p>
            </div>
            <div class="rounded-2xl bg-(--ui-bg-muted) p-3">
              <p class="font-medium text-(--ui-text)">3. 规划大纲</p>
              <p class="mt-1">进入作品详情后编辑或 AI 生成章节大纲。</p>
            </div>
            <div class="rounded-2xl bg-(--ui-bg-muted) p-3">
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

    <div class="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
      <!-- Recent Activity -->
      <section
        v-if="recentActivity?.length"
        class="liquid-panel p-4"
      >
        <h2
          class="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-(--ui-text-dimmed)"
        >
          继续写作
        </h2>
        <div class="grid gap-2">
          <NuxtLink
            v-for="item in recentActivity"
            :key="item.id"
            :to="`/novels/${item.novelId}/chapters/${item.id}`"
            class="group rounded-2xl bg-(--ui-bg-elevated) p-3 ring-1 ring-(--ui-border) transition-all duration-200 hover:-translate-y-0.5 hover:ring-(--ui-border-accented)"
          >
            <div class="mb-2 flex items-center gap-1.5">
              <span
                class="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-400"
                >第{{ item.chapterNumber }}章</span
              >
              <span class="text-[10px] text-(--ui-text-dimmed)">{{
                formatRelativeTime(item.updatedAt)
              }}</span>
            </div>
            <p
              class="truncate text-[14px] font-medium text-(--ui-text) transition-colors group-hover:text-primary-600 dark:group-hover:text-primary-400"
            >
              {{ item.title }}
            </p>
            <p class="mt-1 truncate text-[11px] text-(--ui-text-dimmed)">
              {{ item.novelTitle }}
            </p>
          </NuxtLink>
        </div>
      </section>

      <div class="space-y-4">
        <!-- Reading History -->
        <ReadingHistory />

        <!-- Novels Grid -->
        <section class="liquid-panel p-4">
          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <h2
                class="text-[11px] font-medium uppercase tracking-[0.22em] text-(--ui-text-dimmed)"
              >
                我的作品
              </h2>
              <span
                v-if="total"
                class="text-[11px] text-(--ui-text-dimmed)"
                >{{ total }} 部</span
              >
            </div>
            <div
              v-if="novels.length"
              class="flex items-center gap-2"
            >
              <template v-if="selectionMode">
                <NCheckbox
                  :checked="allNovelsSelected"
                  :indeterminate="
                    selectedNovelIds.length > 0 && !allNovelsSelected
                  "
                  @update:checked="toggleSelectAllNovels"
                >
                  全选
                </NCheckbox>
                <span class="text-[11px] text-(--ui-text-dimmed)"
                  >已选 {{ selectedNovelIds.length }}</span
                >
                <NButton
                  size="tiny"
                  type="error"
                  :disabled="!selectedNovelIds.length"
                  @click="confirmBatchDeleteNovels"
                >
                  <template #icon><Icon icon="lucide:trash-2" /></template>
                  批量删除
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  @click="toggleNovelSelectionMode"
                >
                  退出
                </NButton>
              </template>
              <NButton
                v-else
                size="tiny"
                quaternary
                @click="toggleNovelSelectionMode"
              >
                <template #icon><Icon icon="lucide:list-checks" /></template>
                批量管理
              </NButton>
            </div>
          </div>

          <Transition
            name="fade"
            mode="out-in"
          >
            <div
              v-if="novelsLoading"
              class="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3"
            >
              <NSkeleton
                v-for="i in 6"
                :key="i"
                class="h-44 rounded-xl"
                text
              />
            </div>

            <div
              v-else-if="novels.length"
              key="novels-content"
            >
              <TransitionGroup
                name="list"
                tag="div"
                class="relative grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3"
              >
                <component
                  :is="selectionMode ? 'div' : NuxtLinkComponent"
                  v-for="novel in novels"
                  :key="novel.id"
                  :to="selectionMode ? undefined : `/novels/${novel.id}`"
                  class="group relative flex flex-col overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) transition-all duration-200 hover:border-(--ui-border-accented) hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5"
                  :class="[
                    selectionMode ? 'cursor-pointer' : '',
                    selectionMode && selectedNovelIds.includes(novel.id) ?
                      'ring-2 ring-primary-500 border-primary-500'
                    : ''
                  ]"
                  @click="
                    selectionMode ? toggleNovelSelection(novel.id) : undefined
                  "
                >
                  <!-- Selection checkbox -->
                  <div
                    v-if="selectionMode"
                    class="absolute right-2 top-2 z-10 rounded-md bg-(--ui-bg-elevated)/90 p-0.5 shadow-sm ring-1 ring-(--ui-border)"
                    @click.stop="toggleNovelSelection(novel.id)"
                  >
                    <NCheckbox :checked="selectedNovelIds.includes(novel.id)" />
                  </div>
                  <!-- Top color bar -->
                  <div
                    class="h-1.5 w-full"
                    :style="{ background: getGenreColor(novel.genre) }"
                  />

                  <div class="flex flex-1 flex-col p-3.5">
                    <div class="mb-2 flex items-start justify-between gap-2">
                      <h3
                        class="line-clamp-2 text-[14px] font-semibold leading-snug text-(--ui-text-highlighted) transition-colors group-hover:text-primary-600 dark:group-hover:text-primary-400"
                      >
                        {{ novel.title }}
                      </h3>
                    </div>

                    <p
                      v-if="novel.description"
                      class="mb-3 line-clamp-2 text-[12px] leading-relaxed text-(--ui-text-dimmed)"
                    >
                      {{ novel.description }}
                    </p>
                    <div
                      v-else
                      class="mb-3"
                    />

                    <div
                      class="mt-auto flex items-center justify-between gap-2"
                    >
                      <span
                        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        :class="
                          novel.status === 'completed' ?
                            'bg-emerald-500/10 text-emerald-600'
                          : novel.status === 'in_progress' ?
                            'bg-blue-500/10 text-blue-600'
                          : 'bg-(--ui-bg-muted) text-(--ui-text-dimmed)'
                        "
                      >
                        {{ getStatusLabel(novel.status) }}
                      </span>
                      <span
                        class="text-[11px] font-mono text-(--ui-text-dimmed)"
                        >{{ (novel.wordCount || 0).toLocaleString() }} 字</span
                      >
                    </div>

                    <div
                      class="mt-2.5 flex items-center justify-between border-t border-(--ui-border) pt-2.5 text-[11px] text-(--ui-text-dimmed)"
                    >
                      <span
                        class="font-medium"
                        :style="{ color: getGenreColor(novel.genre) }"
                        >{{ getGenreLabel(novel.genre) }}</span
                      >
                      <span>{{ formatRelativeTime(novel.updatedAt) }}</span>
                    </div>
                  </div>
                </component>
              </TransitionGroup>
              <div
                v-if="totalPages > 1"
                class="flex items-center justify-center pt-4"
              >
                <NPagination
                  :page="page"
                  :page-count="totalPages"
                  :page-size="pageSize"
                  @update:page="goToPage"
                />
              </div>
            </div>

            <div
              v-else
              key="novels-empty"
              class="py-16"
            >
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
          </Transition>
        </section>
      </div>
    </div>

    <NovelCreateWizard
      v-model:show="showCreateModal"
      @created="handleNovelCreated"
    />

    <!-- Import Modal -->
    <NModal
      v-model:show="showImportModal"
      preset="card"
      title="导入小说"
      style="max-width: 560px"
      @after-leave="resetImport"
    >
      <div
        v-if="importStep === 'upload'"
        class="space-y-4"
      >
        <div class="space-y-1">
          <label
            class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider"
            >小说标题</label
          >
          <NInput
            v-model:value="importTitle"
            placeholder="导入后的小说标题"
            size="large"
          />
        </div>
        <div class="space-y-1">
          <label
            class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider"
            >上传文件</label
          >
          <div
            class="rounded-2xl border-2 border-dashed border-(--ui-border) bg-(--ui-bg-muted) p-8 text-center transition-colors hover:bg-(--ui-bg-muted) cursor-pointer"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".txt,.md"
              class="hidden"
              @change="handleFileSelect"
            />
            <Icon
              icon="lucide:upload-cloud"
              class="mx-auto mb-2 size-8 text-(--ui-text-dimmed)"
            />
            <p class="text-sm text-(--ui-text-muted)">
              点击上传 .txt 或 .md 文件
            </p>
            <p class="mt-1 text-xs text-(--ui-text-dimmed)">
              支持按「第X章」或「Chapter X」自动分割章节
            </p>
          </div>
        </div>
      </div>

      <div
        v-else-if="importStep === 'preview'"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-(--ui-text-highlighted)">
              {{ importTitle || '未命名' }}
            </p>
            <p class="text-xs text-(--ui-text-dimmed)">
              共 {{ importPreview.length }} 个章节 ·
              {{ importFormat.toUpperCase() }}
            </p>
          </div>
          <NButton
            size="tiny"
            quaternary
            @click="resetImport"
          >
            <template #icon
              ><Icon
                icon="lucide:upload"
                class="size-3"
            /></template>
            重新上传
          </NButton>
        </div>
        <div class="max-h-80 overflow-y-auto space-y-2 pr-1">
          <div
            v-for="(ch, idx) in importPreview"
            :key="idx"
            class="rounded-2xl bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-2.5"
          >
            <div class="flex items-center justify-between gap-2 mb-1">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-[10px] text-(--ui-text-dimmed) shrink-0"
                  >#{{ idx + 1 }}</span
                >
                <NInput
                  v-model:value="ch.title"
                  size="tiny"
                  class="min-w-0"
                  placeholder="章节标题"
                />
              </div>
              <div class="flex shrink-0 gap-0.5">
                <button
                  class="flex size-6 items-center justify-center rounded text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated) hover:text-(--ui-text) disabled:opacity-30"
                  :disabled="idx === 0"
                  @click="moveImportChapter(idx, -1)"
                >
                  <Icon
                    icon="lucide:chevron-up"
                    class="size-3.5"
                  />
                </button>
                <button
                  class="flex size-6 items-center justify-center rounded text-(--ui-text-dimmed) hover:bg-(--ui-bg-elevated) hover:text-(--ui-text) disabled:opacity-30"
                  :disabled="idx === importPreview.length - 1"
                  @click="moveImportChapter(idx, 1)"
                >
                  <Icon
                    icon="lucide:chevron-down"
                    class="size-3.5"
                  />
                </button>
                <button
                  class="flex size-6 items-center justify-center rounded text-(--ui-text-dimmed) hover:bg-red-500/10 hover:text-red-500"
                  @click="removeImportChapter(idx)"
                >
                  <Icon
                    icon="lucide:x"
                    class="size-3.5"
                  />
                </button>
              </div>
            </div>
            <p class="text-[11px] text-(--ui-text-dimmed) line-clamp-2">
              {{ ch.content.slice(0, 120)
              }}{{ ch.content.length > 120 ? '...' : '' }}
            </p>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            size="small"
            @click="showImportModal = false"
            >{{ t('common.cancel') }}</NButton
          >
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

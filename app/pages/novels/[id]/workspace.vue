<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const message = useMessage()
const { updateActiveTabTitle } = useTabs('user')

interface NovelInfo {
  id: number
  title: string
  description: string | null
}
interface ChapterItem {
  id: number
  chapterNumber: number
  title: string
  status: string
  wordCount: number | null
  summary: string | null
}

const { data: novel } = await useFetch<NovelInfo>(
  `/api/novels/${novelId.value}`
)
const { data: chapters, refresh: refreshChapters } = await useFetch<
  ChapterItem[]
>(`/api/novels/${novelId.value}/chapters`, { default: () => [] })

if (novel.value) {
  updateActiveTabTitle(`${novel.value.title} - AI 工作区`)
}

const activeTab = ref<'generate' | 'review'>('generate')

/* ─────── Generation state ─────── */
const fromChapter = ref(1)
const toChapter = ref(5)
const direction = ref('')
const isGenerating = ref(false)
const generationProgress = ref({ current: 0, total: 0 })
const completedChapters = ref<number[]>([])
const generatedChunks = ref<Map<number, string>>(new Map())
const generatedTitles = ref<Map<number, string>>(new Map())
let abortController: AbortController | null = null

function getMaxChapter() {
  if (!chapters.value?.length) return 1
  return Math.max(...chapters.value.map((c) => c.chapterNumber))
}

function initDefaults() {
  const max = getMaxChapter()
  fromChapter.value = max + 1
  toChapter.value = max + 5
}

initDefaults()

/* ─────── Generation ─────── */
async function startGeneration() {
  if (isGenerating.value) return
  if (toChapter.value - fromChapter.value + 1 > 20) {
    message.warning('单次最多生成20章')
    return
  }

  isGenerating.value = true
  generationProgress.value = {
    current: 0,
    total: toChapter.value - fromChapter.value + 1
  }
  generatedChunks.value.clear()
  generatedTitles.value.clear()
  completedChapters.value = []

  abortController = new AbortController()

  try {
    const response = await fetch('/api/ai/workspace-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: novelId.value,
        fromChapter: fromChapter.value,
        toChapter: toChapter.value,
        direction: direction.value || undefined
      }),
      signal: abortController.signal
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: '请求失败' }))
      throw new Error(err.message || `HTTP ${response.status}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        try {
          const data = JSON.parse(trimmed.slice(6))
          if (data.type === 'outline_filled') {
            const chs: number[] = data.chapters || []
            if (chs.length) {
              message.info(
                `已自动规划第 ${Math.min(...chs)}–${Math.max(...chs)} 章大纲`
              )
            }
          } else if (data.type === 'progress') {
            generationProgress.value = {
              current: data.completed,
              total: data.total
            }
          } else if (data.type === 'chunk') {
            const existing = generatedChunks.value.get(data.chapter) || ''
            generatedChunks.value.set(data.chapter, existing + data.content)
          } else if (data.type === 'title_generated') {
            generatedTitles.value.set(data.chapter, data.title)
          } else if (data.type === 'chapter_done') {
            completedChapters.value.push(data.chapter)
            if (data.title) {
              generatedTitles.value.set(data.chapter, data.title)
            }
            generationProgress.value = {
              current: data.completed,
              total: data.total
            }
          } else if (data.type === 'done') {
            message.success(`成功生成 ${data.completed} 章`)
            await refreshChapters()
          } else if (data.type === 'error') {
            message.error(data.message || '生成失败')
          } else if (data.type === 'cancelled') {
            message.warning('生成已取消')
          }
        } catch {}
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      message.error(err.message || '生成失败')
    }
  } finally {
    isGenerating.value = false
    abortController = null
  }
}

function cancelGeneration() {
  abortController?.abort()
}

/* ─────── Review ─────── */
const selectedChapterIds = ref<number[]>([])
const isReviewing = ref(false)
// 逐章审核：实时累加的问题列表与统计
const reviewIssues = ref<any[]>([])
const reviewStats = ref({
  reviewedCount: 0,
  totalIssues: 0,
  high: 0,
  medium: 0,
  low: 0
})
const reviewProgress = ref({ completed: 0, total: 0 })
const reviewDone = ref(false)
// 严重度软停止：本次因某章 high 问题暂停，剩余章节待用户决定是否继续
const reviewStopped = ref<{
  atChapterNumber: number
  pendingChapterIds: number[]
} | null>(null)

/** 审核期间的章节内容快照，避免采纳后多次 fetch 导致 originalText 失效 */
const chapterContentSnapshot = ref<Map<number, string>>(new Map())
/** 已采用的单条修正 key 集合 */
const appliedIssueKeys = ref<Set<string>>(new Set())

async function prefetchChapterContents(ids: number[]) {
  const targets = ids
    .map((id) => chapters.value?.find((c) => c.id === id))
    .filter((c): c is ChapterItem => !!c)
  // 并发预取，合并进现有快照（「继续审剩余」时保留之前已取的内容）
  const results = await Promise.all(
    targets.map(async (ch) => {
      try {
        const d = await $fetch<{ content?: string }>(
          `/api/novels/${novelId.value}/chapters/${ch.id}`
        )
        return [ch.chapterNumber, d?.content || ''] as const
      } catch {
        return null
      }
    })
  )
  for (const r of results) {
    if (r) chapterContentSnapshot.value.set(r[0], r[1])
  }
}

function selectRecentForReview() {
  if (!chapters.value?.length) return
  const sorted = [...chapters.value].sort(
    (a, b) => b.chapterNumber - a.chapterNumber
  )
  selectedChapterIds.value = sorted.slice(0, 5).map((c) => c.id)
}

/** 模糊匹配 originalText：忽略首尾空白、多余空格、换行符差异 */
function fuzzyIncludes(haystack: string, needle: string): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()
  return normalize(haystack).includes(normalize(needle))
}

/** 模糊替换 originalText → fixedText：忽略空白差异定位原文片段 */
function fuzzyReplace(
  content: string,
  originalText: string,
  fixedText: string
): string | null {
  // 1）精确包含 → 精确替换（只替换第一处）
  if (content.includes(originalText)) {
    return content.replace(originalText, fixedText)
  }
  // 2）normalize 后包含 → 在原文中逐段滑动窗口定位
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const normNeedle = norm(originalText)
  if (!normNeedle) return null
  const normHay = norm(content)
  const idx = normHay.indexOf(normNeedle)
  if (idx < 0) return null

  // 用 normalize 后的字符计数定位原始位置
  let hayCursor = 0
  let rawStart = -1
  let needleNormSeen = 0
  // 先找到 start
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!
    if (ch === '\r') continue
    if (/\s/.test(ch)) {
      // 跳过后续空白，只计第一个空白为一个 norm 字符
      if (i === 0 || !/\s/.test(content[i - 1]!)) hayCursor++
      continue
    }
    hayCursor++
    if (hayCursor === idx + 1) {
      rawStart = i
      break
    }
  }
  if (rawStart < 0) return null

  // 从 rawStart 往后收集原文字节——数出 normNeedle.length 个 norm 字符后截断
  hayCursor = 0
  let rawEnd = rawStart
  let inSpaceRun = false
  for (
    let i = rawStart;
    i < content.length && hayCursor < normNeedle.length;
    i++
  ) {
    const ch = content[i]!
    if (ch === '\r') continue
    if (/\s/.test(ch)) {
      if (!inSpaceRun) {
        hayCursor++
        inSpaceRun = true
      }
    } else {
      hayCursor++
      inSpaceRun = false
    }
    rawEnd = i + 1
  }
  if (hayCursor < normNeedle.length) return null
  return content.slice(0, rawStart) + fixedText + content.slice(rawEnd)
}

async function runReview(chapterIds: number[]) {
  isReviewing.value = true
  try {
    // 预取章节内容快照，供「采用」时精确替换，避免 fetch 到被其它采纳修改后的版本
    await prefetchChapterContents(chapterIds)

    const response = await fetch('/api/ai/workspace-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novelId: novelId.value, chapterIds })
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: '请求失败' }))
      throw new Error(err.message || `HTTP ${response.status}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        try {
          handleReviewEvent(JSON.parse(trimmed.slice(6)))
        } catch {}
      }
    }
  } catch (err: any) {
    message.error(err.message || '审核失败')
  } finally {
    isReviewing.value = false
  }
}

function handleReviewEvent(data: any) {
  if (data.type === 'progress') {
    reviewProgress.value = { completed: data.completed, total: data.total }
  } else if (data.type === 'chapter_reviewed') {
    if (Array.isArray(data.issues) && data.issues.length) {
      reviewIssues.value.push(...data.issues)
    }
    reviewStats.value = {
      reviewedCount: reviewStats.value.reviewedCount + 1,
      totalIssues: reviewStats.value.totalIssues + (data.issues?.length || 0),
      high: reviewStats.value.high + (data.high || 0),
      medium: reviewStats.value.medium + (data.medium || 0),
      low: reviewStats.value.low + (data.low || 0)
    }
    reviewProgress.value = {
      completed: reviewStats.value.reviewedCount,
      total: reviewProgress.value.total
    }
    if (data.parseError) {
      message.warning(`第${data.chapterNumber}章 AI 返回格式异常`)
    }
  } else if (data.type === 'stopped') {
    reviewStopped.value = {
      atChapterNumber: data.atChapterNumber,
      pendingChapterIds: data.pendingChapterIds || []
    }
    message.warning(`第${data.atChapterNumber}章发现严重问题，已暂停审核`)
  } else if (data.type === 'done') {
    reviewDone.value = true
    if (reviewStats.value.totalIssues === 0) {
      message.success('审核通过，未发现问题')
    } else {
      message.info(`共发现 ${reviewStats.value.totalIssues} 个问题`)
    }
  } else if (data.type === 'error') {
    message.error(data.message || '审核失败')
  } else if (data.type === 'cancelled') {
    message.warning('审核已取消')
  }
}

async function startReview() {
  if (!selectedChapterIds.value.length) {
    message.warning('请选择要审核的章节')
    return
  }
  if (isReviewing.value) return
  // 重置审核状态
  reviewIssues.value = []
  reviewStats.value = {
    reviewedCount: 0,
    totalIssues: 0,
    high: 0,
    medium: 0,
    low: 0
  }
  reviewProgress.value = {
    completed: 0,
    total: selectedChapterIds.value.length
  }
  reviewDone.value = false
  reviewStopped.value = null
  appliedIssueKeys.value = new Set()
  chapterContentSnapshot.value = new Map()
  await runReview(selectedChapterIds.value)
}

async function continueReview() {
  const pending = reviewStopped.value?.pendingChapterIds || []
  if (!pending.length || isReviewing.value) return
  reviewStopped.value = null
  reviewDone.value = false
  reviewProgress.value = {
    completed: reviewStats.value.reviewedCount,
    total: reviewStats.value.reviewedCount + pending.length
  }
  await runReview(pending)
}

async function applySingleIssue(issue: any) {
  const ch = chapters.value?.find(
    (c) => c.chapterNumber === issue.chapterNumber
  )
  if (!ch) {
    message.error('找不到对应章节')
    return
  }
  if (!issue.originalText || !issue.fixedText) {
    message.warning('原始文本或修正文本缺失，无法自动采用')
    return
  }
  try {
    // 优先从快照取章节内容，快照不存在才 fetch
    const fetchUrl = `/api/novels/${novelId.value}/chapters/${ch.id}`
    let content = chapterContentSnapshot.value.get(issue.chapterNumber) ?? ''
    if (!content) {
      const d = await $fetch<{ content?: string }>(fetchUrl)
      content = d?.content || ''
    }

    // 使用模糊匹配（忽略空白差异）
    if (!fuzzyIncludes(content, issue.originalText)) {
      message.warning('已采纳的内容已变化，当前内容已无此原文段')
      return
    }

    const updated = fuzzyReplace(content, issue.originalText, issue.fixedText)
    if (updated === null) {
      message.warning('原文定位失败，章节内容可能已有较大变化')
      return
    }

    await $fetch(fetchUrl, {
      method: 'PUT',
      body: { content: updated }
    })

    // 同步更新本地快照，后续同章 issue 立即可见
    chapterContentSnapshot.value.set(issue.chapterNumber, updated)

    const key = issueKey(issue)
    appliedIssueKeys.value.add(key)
    appliedIssueKeys.value = new Set(appliedIssueKeys.value)
    message.success(`第${issue.chapterNumber}章已修正`)
    await refreshChapters()
  } catch (err: any) {
    message.error(err.message || '应用修正失败')
  }
}

function issueKey(issue: any) {
  return `${issue.chapterNumber}-${issue.type}-${issue.description.slice(0, 30)}`
}

/** 跳转到 issue 对应的章节编辑页，并带上 issue 描述作为搜索提示 */
function openChapterForIssue(issue: any) {
  const ch = chapters.value?.find(
    (c) => c.chapterNumber === issue.chapterNumber
  )
  if (!ch) {
    message.warning('找不到对应章节')
    return
  }
  navigateTo(`/novels/${novelId.value}/chapters/${ch.id}`)
}

/* ─────── Helpers ─────── */
function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    plot_hole: '情节漏洞',
    character_inconsistency: '角色不一致',
    pacing: '节奏问题',
    foreshadowing_dangling: '伏笔未回收',
    repetition: '重复内容',
    style_deviation: '风格偏离',
    factual_error: '事实错误'
  }
  return labels[type] || type
}

const progressPercent = computed(() => {
  if (!generationProgress.value.total) return 0
  return Math.round(
    (generationProgress.value.current / generationProgress.value.total) * 100
  )
})

const sortedChunks = computed(() => {
  return [...generatedChunks.value.entries()].sort((a, b) => a[0] - b[0])
})

const issuesByChapter = computed(() => {
  const grouped: Record<number, any[]> = {}
  for (const issue of reviewIssues.value) {
    const ch = issue.chapterNumber
    if (!grouped[ch]) grouped[ch] = []
    grouped[ch].push(issue)
  }
  return grouped
})

const reviewPercent = computed(() => {
  if (!reviewProgress.value.total) return 0
  return Math.round(
    (reviewProgress.value.completed / reviewProgress.value.total) * 100
  )
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Top bar with tabs -->
    <div
      class="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-(--ui-border)"
    >
      <NButton
        quaternary
        size="small"
        @click="navigateTo(`/novels/${novelId}`)"
      >
        <template #icon
          ><Icon
            icon="lucide:arrow-left"
            class="w-4 h-4"
        /></template>
        返回
      </NButton>
      <div class="flex items-center gap-2">
        <Icon
          icon="lucide:workflow"
          class="w-4 h-4 text-primary-500"
        />
        <span class="font-semibold text-(--ui-text-highlighted)"
          >AI 工作区</span
        >
        <span
          v-if="novel"
          class="text-sm text-(--ui-text-dimmed)"
          >- {{ novel.title }}</span
        >
      </div>
      <NTabs
        v-model:value="activeTab"
        type="line"
        size="small"
        class="ml-4"
        style="max-width: 280px"
      >
        <NTab name="generate">批量生成</NTab>
        <NTab name="review">AI 审核</NTab>
      </NTabs>
    </div>

    <!-- Main layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left sidebar -->
      <div
        class="w-80 shrink-0 border-r border-(--ui-border) overflow-y-auto p-4 space-y-4"
      >
        <!-- ===== Generate Sidebar ===== -->
        <template v-if="activeTab === 'generate'">
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">
              批量生成
            </h3>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs text-(--ui-text-dimmed)">起始章节</label>
                <NInputNumber
                  v-model:value="fromChapter"
                  :min="1"
                  size="small"
                  :disabled="isGenerating"
                />
              </div>
              <div>
                <label class="text-xs text-(--ui-text-dimmed)">结束章节</label>
                <NInputNumber
                  v-model:value="toChapter"
                  :min="fromChapter"
                  :max="fromChapter + 20"
                  size="small"
                  :disabled="isGenerating"
                />
              </div>
            </div>
            <div>
              <label class="text-xs text-(--ui-text-dimmed)"
                >写作方向（可选）</label
              >
              <NInput
                v-model:value="direction"
                type="textarea"
                placeholder="描述这批章节的整体方向..."
                :rows="2"
                size="small"
                :disabled="isGenerating"
              />
            </div>
            <p class="text-xs text-(--ui-text-dimmed)">
              将生成
              {{ toChapter - fromChapter + 1 }}
              章，每章自动获取前一章全文作为上下文。
            </p>
            <template v-if="isGenerating">
              <NProgress
                :percentage="progressPercent"
                :show-indicator="true"
              />
              <p class="text-xs text-(--ui-text-dimmed)">
                正在生成：{{ generationProgress.current }} /
                {{ generationProgress.total }} 章
              </p>
            </template>
            <div class="flex gap-2">
              <NButton
                v-if="!isGenerating"
                type="primary"
                size="small"
                class="flex-1"
                @click="startGeneration"
              >
                <template #icon><Icon icon="lucide:play" /></template>
                开始生成
              </NButton>
              <NButton
                v-if="isGenerating"
                size="small"
                class="flex-1"
                @click="cancelGeneration"
              >
                <template #icon><Icon icon="lucide:stop-circle" /></template>
                取消生成
              </NButton>
            </div>
            <div
              v-if="completedChapters.length"
              class="flex flex-wrap gap-1"
            >
              <NTag
                v-for="ch in completedChapters"
                :key="ch"
                size="tiny"
                type="success"
                >第{{ ch }}章</NTag
              >
            </div>
          </div>
        </template>

        <!-- ===== Review Sidebar ===== -->
        <template v-if="activeTab === 'review'">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">
                选择章节
              </h3>
              <NButton
                size="tiny"
                @click="selectRecentForReview"
                >最近5章</NButton
              >
            </div>
            <div class="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              <NTag
                v-for="ch in chapters"
                :key="ch.id"
                :type="
                  selectedChapterIds.includes(ch.id) ? 'primary' : 'default'
                "
                size="small"
                checkable
                :checked="selectedChapterIds.includes(ch.id)"
                @click="
                  () => {
                    const idx = selectedChapterIds.indexOf(ch.id)
                    if (idx >= 0) selectedChapterIds.splice(idx, 1)
                    else selectedChapterIds.push(ch.id)
                  }
                "
              >
                第{{ ch.chapterNumber }}章
              </NTag>
            </div>
            <NButton
              type="primary"
              size="small"
              :loading="isReviewing"
              :disabled="isReviewing || !selectedChapterIds.length"
              @click="startReview"
              block
            >
              {{ isReviewing ? '审核中...' : '开始审核' }}
            </NButton>

            <!-- 进度 / 统计 / 软停止 -->
            <div
              v-if="isReviewing || reviewStats.reviewedCount || reviewStopped"
              class="space-y-2"
            >
              <div v-if="isReviewing">
                <NProgress
                  :percentage="reviewPercent"
                  :show-indicator="false"
                  size="small"
                />
                <p class="text-xs text-(--ui-text-dimmed) mt-1">
                  正在审核：{{ reviewProgress.completed }} /
                  {{ reviewProgress.total }} 章
                </p>
              </div>
              <div
                v-if="reviewStats.reviewedCount"
                class="flex items-center gap-2 flex-wrap"
              >
                <NTag
                  :type="reviewStats.totalIssues > 0 ? 'warning' : 'success'"
                  size="small"
                >
                  {{
                    reviewStats.totalIssues > 0 ?
                      `${reviewStats.totalIssues} 个问题`
                    : '暂无问题'
                  }}
                </NTag>
                <span
                  v-if="reviewStats.high"
                  class="text-red-500 text-xs"
                  >高: {{ reviewStats.high }}</span
                >
                <span
                  v-if="reviewStats.medium"
                  class="text-amber-500 text-xs"
                  >中: {{ reviewStats.medium }}</span
                >
                <span
                  v-if="reviewStats.low"
                  class="text-blue-500 text-xs"
                  >低: {{ reviewStats.low }}</span
                >
              </div>
              <div
                v-if="reviewStopped"
                class="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2"
              >
                <p class="text-xs text-red-500 leading-relaxed">
                  第 {{ reviewStopped.atChapterNumber }}
                  章发现严重(high)问题，已暂停。剩余
                  {{ reviewStopped.pendingChapterIds.length }} 章未审。
                </p>
                <NButton
                  v-if="reviewStopped.pendingChapterIds.length"
                  size="tiny"
                  type="primary"
                  :loading="isReviewing"
                  block
                  @click="continueReview"
                >
                  继续审剩余 {{ reviewStopped.pendingChapterIds.length }} 章
                </NButton>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ===== Right Content ===== -->
      <div class="flex-1 overflow-y-auto">
        <!-- Generate content -->
        <div
          v-if="activeTab === 'generate'"
          class="h-full"
        >
          <div
            v-if="sortedChunks.length === 0 && !isGenerating"
            class="h-full flex flex-col items-center justify-center text-(--ui-text-dimmed)"
          >
            <Icon
              icon="lucide:sparkles"
              class="w-16 h-16 mb-4 opacity-20"
            />
            <p class="text-sm font-medium">配置参数后点击「开始生成」</p>
            <p class="text-xs mt-1">生成的内容将在此处实时预览</p>
          </div>
          <div
            v-else
            class="p-6 space-y-6"
          >
            <div
              v-for="[chapterNum, content] in sortedChunks"
              :key="chapterNum"
              class="border border-(--ui-border)/30 rounded-lg overflow-hidden"
            >
              <div
                class="flex items-center justify-between px-4 py-3 bg-(--ui-bg-muted)/50 border-b border-(--ui-border)/20"
              >
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-(--ui-text-highlighted)"
                    >第{{ chapterNum }}章</span
                  >
                  <span
                    v-if="generatedTitles.get(chapterNum)"
                    class="text-sm text-(--ui-text)"
                    >{{ generatedTitles.get(chapterNum) }}</span
                  >
                  <NTag
                    v-if="completedChapters.includes(chapterNum)"
                    size="tiny"
                    type="success"
                    >已完成</NTag
                  >
                  <NTag
                    v-else-if="
                      isGenerating && generationProgress.current === chapterNum
                    "
                    size="tiny"
                    type="warning"
                    >生成中...</NTag
                  >
                </div>
                <span class="text-xs text-(--ui-text-dimmed)"
                  >{{ content.replace(/\s/g, '').length }} 字</span
                >
              </div>
              <div class="px-4 py-3 max-h-96 overflow-y-auto">
                <p
                  class="text-sm leading-relaxed text-(--ui-text) whitespace-pre-wrap font-serif"
                >
                  {{ content }}
                </p>
                <div
                  v-if="
                    isGenerating && generationProgress.current === chapterNum
                  "
                  class="flex items-center gap-1 text-xs text-primary-500 mt-2"
                >
                  <Icon
                    icon="lucide:loader-2"
                    class="w-3 h-3 animate-spin"
                  />
                  正在生成...
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Review content -->
        <div
          v-if="activeTab === 'review'"
          class="h-full"
        >
          <div
            v-if="
              !isReviewing &&
              !reviewIssues.length &&
              !reviewDone &&
              !reviewStopped
            "
            class="h-full flex flex-col items-center justify-center text-(--ui-text-dimmed)"
          >
            <Icon
              icon="lucide:shield-check"
              class="w-16 h-16 mb-4 opacity-20"
            />
            <p class="text-sm font-medium">选择章节后点击「开始审核」</p>
            <p class="text-xs mt-1">将逐章检测，发现严重(high)问题会自动暂停</p>
          </div>

          <div
            v-else
            class="p-6 space-y-6"
          >
            <!-- 审核中实时进度 -->
            <div
              v-if="isReviewing"
              class="flex items-center gap-2 text-sm text-primary-500"
            >
              <Icon
                icon="lucide:loader-2"
                class="w-4 h-4 animate-spin"
              />
              正在逐章审核：{{ reviewProgress.completed }} /
              {{ reviewProgress.total }} 章
            </div>

            <!-- 软停止提示 -->
            <div
              v-if="reviewStopped"
              class="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3"
            >
              <p class="text-sm text-red-500">
                第 {{ reviewStopped.atChapterNumber }}
                章发现严重(high)问题，已暂停。剩余
                {{ reviewStopped.pendingChapterIds.length }} 章未审。
              </p>
              <NButton
                v-if="reviewStopped.pendingChapterIds.length"
                size="small"
                type="primary"
                :loading="isReviewing"
                @click="continueReview"
              >
                继续审剩余
              </NButton>
            </div>

            <div
              v-for="(chapterIssues, chNum) in issuesByChapter"
              :key="chNum"
            >
              <div
                class="rounded-xl border border-(--ui-border)/40 overflow-hidden"
              >
                <div
                  class="flex items-center justify-between px-4 py-3 bg-(--ui-bg-muted)/50 border-b border-(--ui-border)/20"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="font-semibold text-sm text-(--ui-text-highlighted)"
                      >第{{ chNum }}章</span
                    >
                    <NTag
                      size="tiny"
                      :type="
                        chapterIssues.some((i: any) => i.severity === 'high') ?
                          'error'
                        : (
                          chapterIssues.some(
                            (i: any) => i.severity === 'medium'
                          )
                        ) ?
                          'warning'
                        : 'info'
                      "
                    >
                      {{ chapterIssues.length }} 个问题
                    </NTag>
                  </div>
                  <NButton
                    size="tiny"
                    quaternary
                    type="primary"
                    @click="openChapterForIssue(chapterIssues[0])"
                  >
                    <template #icon
                      ><Icon
                        icon="lucide:pen-line"
                        class="w-3 h-3"
                    /></template>
                    去编辑
                  </NButton>
                </div>
                <div class="divide-y divide-(--ui-border)/20">
                  <div
                    v-for="(issue, idx) in chapterIssues"
                    :key="idx"
                    class="px-4 py-3 space-y-2"
                  >
                    <div class="flex items-center gap-2">
                      <span
                        class="w-2 h-2 rounded-full shrink-0"
                        :class="
                          issue.severity === 'high' ? 'bg-red-500'
                          : issue.severity === 'medium' ? 'bg-amber-500'
                          : 'bg-blue-500'
                        "
                      />
                      <NTag
                        size="tiny"
                        :type="
                          issue.severity === 'high' ? 'error'
                          : issue.severity === 'medium' ? 'warning'
                          : 'info'
                        "
                        bordered
                      >
                        {{ getTypeLabel(issue.type) }}
                      </NTag>
                    </div>
                    <p class="text-sm text-(--ui-text) leading-relaxed">
                      {{ issue.description }}
                    </p>
                    <p
                      v-if="issue.suggestion"
                      class="text-xs text-(--ui-text-muted) italic bg-(--ui-bg-muted)/50 rounded-lg px-3 py-2"
                    >
                      建议：{{ issue.suggestion }}
                    </p>
                    <!-- 有 fixedText 时：显示原文vs修正对比 + 采用按钮 -->
                    <div
                      v-if="issue.fixedText"
                      class="rounded-lg border border-(--ui-border)/30 overflow-hidden text-xs"
                    >
                      <div
                        class="px-3 py-2 bg-red-500/5 border-b border-(--ui-border)/20"
                      >
                        <p class="text-(--ui-text-dimmed) text-[10px] mb-0.5">
                          原文：
                        </p>
                        <p
                          class="text-red-400 line-through whitespace-pre-wrap"
                        >
                          {{
                            issue.originalText ||
                            '（AI未返回精确原文片段，参考上方描述在章节中定位）'
                          }}
                        </p>
                      </div>
                      <div
                        class="px-3 py-2 bg-emerald-500/5 flex items-start justify-between gap-2"
                      >
                        <div class="flex-1 min-w-0">
                          <p class="text-(--ui-text-dimmed) text-[10px] mb-0.5">
                            修正：
                          </p>
                          <p class="text-emerald-400 whitespace-pre-wrap">
                            {{ issue.fixedText }}
                          </p>
                        </div>
                        <NButton
                          size="tiny"
                          class="shrink-0"
                          :type="
                            appliedIssueKeys.has(issueKey(issue)) ? 'success'
                            : 'primary'
                          "
                          :disabled="appliedIssueKeys.has(issueKey(issue))"
                          @click="applySingleIssue(issue)"
                        >
                          {{
                            appliedIssueKeys.has(issueKey(issue)) ? '已采用' : (
                              '采用'
                            )
                          }}
                        </NButton>
                      </div>
                    </div>
                    <!-- 仅有 originalText（无 fixedText）：显示原文引用，不可采纳但可预览 -->
                    <div
                      v-else-if="issue.originalText"
                      class="rounded-lg border border-(--ui-border)/30 overflow-hidden text-xs"
                    >
                      <div class="px-3 py-2 bg-amber-500/5">
                        <p class="text-(--ui-text-dimmed) text-[10px] mb-0.5">
                          原文引用：
                        </p>
                        <p class="text-(--ui-text) whitespace-pre-wrap">
                          {{ issue.originalText }}
                        </p>
                      </div>
                    </div>
                    <!-- 统一提供跳转到对应章节编辑页 -->
                    <div class="flex justify-end">
                      <NButton
                        size="tiny"
                        quaternary
                        type="primary"
                        @click="openChapterForIssue(issue)"
                      >
                        <template #icon
                          ><Icon
                            icon="lucide:pen-line"
                            class="w-3 h-3"
                        /></template>
                        跳转编辑
                      </NButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="reviewDone && !reviewIssues.length"
              class="h-64 flex flex-col items-center justify-center text-emerald-500"
            >
              <Icon
                icon="lucide:check-circle-2"
                class="w-16 h-16 mb-3 opacity-50"
              />
              <p class="text-sm font-medium">审核通过，未发现问题</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

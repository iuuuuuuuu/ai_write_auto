<script setup lang="ts">
import { cleanAiChapterTitle } from '../../../utils/chapter-title'

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

const { data: novel } = await useFetch<NovelInfo>(`/api/novels/${novelId.value}`)
const { data: chapters, refresh: refreshChapters } = await useFetch<ChapterItem[]>(
  `/api/novels/${novelId.value}/chapters`,
  { default: () => [] }
)

if (novel.value) {
  updateActiveTabTitle(`${novel.value.title} - AI 工作区`)
}

/* ─────── Generation state ─────── */
const fromChapter = ref(1)
const toChapter = ref(5)
const direction = ref('')
const isGenerating = ref(false)
const generationProgress = ref({ current: 0, total: 0 })
const completedChapters = ref<number[]>([])
const generatedChunks = ref<Map<number, string>>(new Map())
const generatedTitles = ref<Map<number, string>>(new Map())
const isGeneratingTitles = ref(false)
let abortController: AbortController | null = null

function getMaxChapter() {
  if (!chapters.value?.length) return 1
  return Math.max(...chapters.value.map(c => c.chapterNumber))
}

function initDefaults() {
  const max = getMaxChapter()
  fromChapter.value = max + 1
  toChapter.value = max + 5
}

initDefaults()

/* ─────── Title generation ─────── */
async function generateTitlesForCompleted() {
  if (!completedChapters.value.length) return
  isGeneratingTitles.value = true
  // Re-fetch chapters to get the newly saved ones
  await refreshChapters()
  const sortedTitles: string[] = []
  for (const chNum of [...completedChapters.value].sort((a, b) => a - b)) {
    const ch = chapters.value?.find(c => c.chapterNumber === chNum)
    if (!ch) continue
    const prevCh = chapters.value?.find(c => c.chapterNumber === chNum - 1)
    try {
      const res = await $fetch<{ title: string }>('/api/ai/suggest-title', {
        method: 'POST',
        body: {
          novelId: novelId.value,
          chapterId: ch.id,
          previousChapterTitle: prevCh?.title || sortedTitles[sortedTitles.length - 1] || undefined
        }
      })
      const cleaned = cleanAiChapterTitle(res.title)
      if (cleaned) {
        generatedTitles.value.set(chNum, cleaned)
        sortedTitles.push(cleaned)
      }
    } catch {}
  }
  isGeneratingTitles.value = false
}

/* ─────── Generation ─────── */
async function startGeneration() {
  if (isGenerating.value) return
  if (toChapter.value - fromChapter.value + 1 > 20) {
    message.warning('单次最多生成20章')
    return
  }

  isGenerating.value = true
  generationProgress.value = { current: 0, total: toChapter.value - fromChapter.value + 1 }
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
          if (data.type === 'progress') {
            generationProgress.value = { current: data.completed, total: data.total }
          } else if (data.type === 'chunk') {
            const existing = generatedChunks.value.get(data.chapter) || ''
            generatedChunks.value.set(data.chapter, existing + data.content)
          } else if (data.type === 'chapter_done') {
            completedChapters.value.push(data.chapter)
            generationProgress.value = { current: data.completed, total: data.total }
          } else if (data.type === 'done') {
            message.success(`成功生成 ${data.completed} 章`)
            // Auto-generate titles after content generation
            generateTitlesForCompleted()
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
const reviewResult = ref<any>(null)
const autoFix = ref(false)

function selectRecentForReview() {
  if (!chapters.value?.length) return
  const sorted = [...chapters.value].sort((a, b) => b.chapterNumber - a.chapterNumber)
  selectedChapterIds.value = sorted.slice(0, 5).map(c => c.id)
}

async function startReview() {
  if (!selectedChapterIds.value.length) {
    message.warning('请选择要审核的章节')
    return
  }
  isReviewing.value = true
  reviewResult.value = null
  try {
    const result = await $fetch('/api/ai/workspace-review', {
      method: 'POST',
      body: {
        novelId: novelId.value,
        chapterIds: selectedChapterIds.value,
        autoFix: autoFix.value
      }
    })
    reviewResult.value = result
    if (result.issuesFound === 0) {
      message.success('审核通过，未发现问题')
    } else {
      message.info(`发现 ${result.issuesFound} 个问题`)
    }
  } catch (err: any) {
    message.error(err.message || '审核失败')
  } finally {
    isReviewing.value = false
  }
}

async function applyAutoFix(fixedChapter: { chapterId: number; chapterNumber: number; fixedContent: string }) {
  try {
    await $fetch(`/api/novels/${novelId.value}/chapters/${fixedChapter.chapterId}`, {
      method: 'PUT',
      body: { content: fixedChapter.fixedContent }
    })
    message.success(`第${fixedChapter.chapterNumber}章已修正`)
    await refreshChapters()
  } catch (err: any) {
    message.error(err.message || '应用修正失败')
  }
}

/* ─────── Helpers ─────── */
function getSeverityColor(severity: string) {
  if (severity === 'high') return 'text-red-500'
  if (severity === 'medium') return 'text-amber-500'
  return 'text-blue-500'
}

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
  return Math.round((generationProgress.value.current / generationProgress.value.total) * 100)
})

const sortedChunks = computed(() => {
  return [...generatedChunks.value.entries()].sort((a, b) => a[0] - b[0])
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Top bar -->
    <div class="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-(--ui-border)">
      <NButton quaternary size="small" @click="navigateTo(`/novels/${novelId}`)">
        <template #icon><Icon icon="lucide:arrow-left" class="w-4 h-4" /></template>
        返回
      </NButton>
      <div class="flex items-center gap-2">
        <Icon icon="lucide:workflow" class="w-4 h-4 text-primary-500" />
        <span class="font-semibold text-(--ui-text-highlighted)">AI 工作区</span>
        <span v-if="novel" class="text-sm text-(--ui-text-dimmed)">- {{ novel.title }}</span>
      </div>
    </div>

    <!-- Main layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left sidebar -->
      <div class="w-80 shrink-0 border-r border-(--ui-border) overflow-y-auto p-4 space-y-4">
        <!-- Generation controls -->
        <div class="space-y-3">
          <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">批量生成</h3>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-(--ui-text-dimmed)">起始章节</label>
              <NInputNumber v-model:value="fromChapter" :min="1" size="small" :disabled="isGenerating" />
            </div>
            <div>
              <label class="text-xs text-(--ui-text-dimmed)">结束章节</label>
              <NInputNumber v-model:value="toChapter" :min="fromChapter" :max="fromChapter + 20" size="small" :disabled="isGenerating" />
            </div>
          </div>
          <div>
            <label class="text-xs text-(--ui-text-dimmed)">写作方向（可选）</label>
            <NInput v-model:value="direction" type="textarea" placeholder="描述这批章节的整体方向..." :rows="2" size="small" :disabled="isGenerating" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">
            将生成 {{ toChapter - fromChapter + 1 }} 章，每章自动获取前一章全文作为上下文。
          </p>

          <!-- Progress -->
          <template v-if="isGenerating">
            <NProgress :percentage="progressPercent" :show-indicator="true" />
            <p class="text-xs text-(--ui-text-dimmed)">
              正在生成：{{ generationProgress.current }} / {{ generationProgress.total }} 章
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

          <!-- Completed tags -->
          <div v-if="completedChapters.length" class="flex flex-wrap gap-1">
            <NTag v-for="ch in completedChapters" :key="ch" size="tiny" type="success">
              第{{ ch }}章
            </NTag>
          </div>

          <!-- Title generation indicator -->
          <div v-if="isGeneratingTitles" class="flex items-center gap-2 text-xs text-(--ui-text-dimmed)">
            <Icon icon="lucide:loader-2" class="w-3 h-3 animate-spin" />
            正在生成标题...
          </div>
        </div>

        <NDivider />

        <!-- Review section -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">AI 审核</h3>
            <NButton size="tiny" @click="selectRecentForReview">最近5章</NButton>
          </div>
          <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            <NTag
              v-for="ch in chapters"
              :key="ch.id"
              :type="selectedChapterIds.includes(ch.id) ? 'primary' : 'default'"
              size="small"
              checkable
              :checked="selectedChapterIds.includes(ch.id)"
              @click="() => {
                const idx = selectedChapterIds.indexOf(ch.id)
                if (idx >= 0) selectedChapterIds.splice(idx, 1)
                else selectedChapterIds.push(ch.id)
              }"
            >
              第{{ ch.chapterNumber }}章
            </NTag>
          </div>
          <div class="flex items-center gap-2">
            <NSwitch v-model:value="autoFix" size="small" />
            <span class="text-xs text-(--ui-text-dimmed)">自动修正</span>
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

          <!-- Review results -->
          <div v-if="reviewResult" class="space-y-2">
            <div class="flex items-center gap-2 text-sm">
              <NTag :type="reviewResult.issuesFound > 0 ? 'warning' : 'success'" size="small">
                {{ reviewResult.issuesFound > 0 ? `${reviewResult.issuesFound} 个问题` : '审核通过' }}
              </NTag>
              <span v-if="reviewResult.highSeverity" class="text-red-500 text-xs">高: {{ reviewResult.highSeverity }}</span>
              <span v-if="reviewResult.mediumSeverity" class="text-amber-500 text-xs">中: {{ reviewResult.mediumSeverity }}</span>
              <span v-if="reviewResult.lowSeverity" class="text-blue-500 text-xs">低: {{ reviewResult.lowSeverity }}</span>
            </div>

            <div v-if="reviewResult.issues?.length" class="space-y-2 max-h-48 overflow-y-auto">
              <div v-for="(issue, idx) in reviewResult.issues" :key="idx" class="rounded bg-(--ui-bg-muted) p-2 space-y-1">
                <div class="flex items-center gap-2">
                  <NTag size="tiny" :type="issue.severity === 'high' ? 'error' : issue.severity === 'medium' ? 'warning' : 'info'">
                    {{ issue.severity }}
                  </NTag>
                  <span class="text-xs font-medium" :class="getSeverityColor(issue.severity)">
                    {{ getTypeLabel(issue.type) }}
                  </span>
                  <span class="text-[10px] text-(--ui-text-dimmed)">第{{ issue.chapterNumber }}章</span>
                </div>
                <p class="text-xs text-(--ui-text)">{{ issue.description }}</p>
                <p v-if="issue.suggestion" class="text-xs text-(--ui-text-muted) italic">建议：{{ issue.suggestion }}</p>
              </div>
            </div>

            <div v-if="reviewResult.fixedChapters?.length" class="space-y-2">
              <p class="text-xs font-medium text-(--ui-text-dimmed)">AI 自动修正：</p>
              <div v-for="fc in reviewResult.fixedChapters" :key="fc.chapterId" class="flex items-center justify-between rounded bg-(--ui-bg-muted) p-2">
                <span class="text-xs">第{{ fc.chapterNumber }}章</span>
                <NButton size="tiny" type="primary" @click="applyAutoFix(fc)">应用</NButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main content area -->
      <div class="flex-1 overflow-y-auto">
        <!-- Empty state -->
        <div
          v-if="sortedChunks.length === 0 && !isGenerating"
          class="h-full flex flex-col items-center justify-center text-(--ui-text-dimmed)"
        >
          <Icon icon="lucide:file-plus-2" class="w-12 h-12 mb-3 opacity-30" />
          <p class="text-sm">配置参数后点击「开始生成」</p>
          <p class="text-xs mt-1">生成的内容将在此处实时预览</p>
        </div>

        <!-- Generated chapters list -->
        <div v-else class="p-6 space-y-6">
          <div
            v-for="[chapterNum, content] in sortedChunks"
            :key="chapterNum"
            class="border border-(--ui-border)/30 rounded-lg overflow-hidden"
          >
            <!-- Chapter header -->
            <div class="flex items-center justify-between px-4 py-3 bg-(--ui-bg-muted)/50 border-b border-(--ui-border)/20">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-(--ui-text-highlighted)">
                  第{{ chapterNum }}章
                </span>
                <span v-if="generatedTitles.get(chapterNum)" class="text-sm text-(--ui-text)">
                  {{ generatedTitles.get(chapterNum) }}
                </span>
                <NTag
                  v-if="completedChapters.includes(chapterNum)"
                  size="tiny"
                  type="success"
                >
                  已完成
                </NTag>
                <NTag
                  v-else-if="isGenerating && generationProgress.current === chapterNum"
                  size="tiny"
                  type="warning"
                >
                  生成中...
                </NTag>
              </div>
              <span class="text-xs text-(--ui-text-dimmed)">
                {{ content.replace(/\s/g, '').length }} 字
              </span>
            </div>
            <!-- Chapter content -->
            <div class="px-4 py-3 max-h-96 overflow-y-auto">
              <p class="text-sm leading-relaxed text-(--ui-text) whitespace-pre-wrap font-serif">
                {{ content }}
              </p>
              <div
                v-if="isGenerating && generationProgress.current === chapterNum"
                class="flex items-center gap-1 text-xs text-primary-500 mt-2"
              >
                <Icon icon="lucide:loader-2" class="w-3 h-3 animate-spin" />
                正在生成...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  novelId: number
  chapters: Array<{ id: number; chapterNumber: number; title: string; status: string }>
}>()

const emit = defineEmits<{
  refresh: []
}>()

const message = useMessage()

// Workspace state
const fromChapter = ref(1)
const toChapter = ref(5)
const direction = ref('')
const isGenerating = ref(false)
const generationProgress = ref({ current: 0, total: 0 })
const generatedChunks = ref<Map<number, string>>(new Map())
const completedChapters = ref<number[]>([])
const showWorkspace = ref(false)

// Review state
const selectedChapterIds = ref<number[]>([])
const isReviewing = ref(false)
const reviewResult = ref<any>(null)
const showReviewDialog = ref(false)
const autoFix = ref(false)

let abortController: AbortController | null = null

function getMaxChapter() {
  if (!props.chapters.length) return 1
  return Math.max(...props.chapters.map(c => c.chapterNumber))
}

function initWorkspace() {
  const max = getMaxChapter()
  fromChapter.value = max + 1
  toChapter.value = max + 5
  direction.value = ''
  generatedChunks.value.clear()
  completedChapters.value = []
  showWorkspace.value = true
}

async function startWorkspaceGeneration() {
  if (isGenerating.value) return
  if (toChapter.value - fromChapter.value + 1 > 20) {
    message.warning('单次最多生成20章')
    return
  }

  isGenerating.value = true
  generationProgress.value = { current: 0, total: toChapter.value - fromChapter.value + 1 }
  generatedChunks.value.clear()
  completedChapters.value = []

  abortController = new AbortController()

  try {
    const response = await fetch('/api/ai/workspace-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: props.novelId,
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
            emit('refresh')
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

function toggleChapterForReview(chapterId: number) {
  const idx = selectedChapterIds.value.indexOf(chapterId)
  if (idx >= 0) {
    selectedChapterIds.value.splice(idx, 1)
  } else {
    selectedChapterIds.value.push(chapterId)
  }
}

function selectRecentForReview() {
  const sorted = [...props.chapters].sort((a, b) => b.chapterNumber - a.chapterNumber)
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
        novelId: props.novelId,
        chapterIds: selectedChapterIds.value,
        autoFix: autoFix.value
      }
    })
    reviewResult.value = result
    showReviewDialog.value = true

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
    await $fetch(`/api/novels/${props.novelId}/chapters/${fixedChapter.chapterId}`, {
      method: 'PUT',
      body: { content: fixedChapter.fixedContent }
    })
    message.success(`第${fixedChapter.chapterNumber}章已修正`)
    emit('refresh')
  } catch (err: any) {
    message.error(err.message || '应用修正失败')
  }
}

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
</script>

<template>
  <div class="space-y-3">
    <!-- Action Buttons -->
    <div class="flex gap-2">
      <NButton size="small" @click="initWorkspace">
        <template #icon><Icon icon="lucide:workflow" class="w-3.5 h-3.5" /></template>
        AI 工作区
      </NButton>
      <NButton size="small" @click="showReviewDialog = true; selectRecentForReview()">
        <template #icon><Icon icon="lucide:shield-check" class="w-3.5 h-3.5" /></template>
        AI 审核
      </NButton>
    </div>

    <!-- Workspace Modal -->
    <NModal v-model:show="showWorkspace" preset="card" title="AI 工作区 - 多章连贯生成" style="max-width: 700px; max-height: 85vh">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-(--ui-text-dimmed)">起始章节</label>
            <NInputNumber v-model:value="fromChapter" :min="1" size="small" />
          </div>
          <div>
            <label class="text-xs font-medium text-(--ui-text-dimmed)">结束章节</label>
            <NInputNumber v-model:value="toChapter" :min="fromChapter" :max="fromChapter + 20" size="small" />
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-(--ui-text-dimmed)">写作方向（可选）</label>
          <NInput v-model:value="direction" type="textarea" placeholder="描述这批章节的整体方向..." :rows="2" size="small" />
        </div>

        <div class="text-xs text-(--ui-text-dimmed)">
          将生成 {{ toChapter - fromChapter + 1 }} 章，每章自动获取前一章全文作为上下文，确保连贯性。
        </div>

        <!-- Progress -->
        <div v-if="isGenerating" class="space-y-2">
          <NProgress :percentage="Math.round((generationProgress.current / generationProgress.total) * 100)" :show-indicator="true" />
          <p class="text-xs text-(--ui-text-dimmed)">
            正在生成：{{ generationProgress.current }} / {{ generationProgress.total }} 章
          </p>
          <div v-if="completedChapters.length" class="flex flex-wrap gap-1">
            <NTag v-for="ch in completedChapters" :key="ch" size="tiny" type="success">
              第{{ ch }}章 ?
            </NTag>
          </div>
        </div>

        <!-- Preview of current generation -->
        <div v-if="generatedChunks.size > 0" class="max-h-40 overflow-y-auto rounded bg-(--ui-bg-muted) p-2">
          <div v-for="[chapterNum, content] in generatedChunks" :key="chapterNum" class="mb-2">
            <p class="text-[10px] font-bold text-(--ui-text-dimmed)">第{{ chapterNum }}章</p>
            <p class="text-xs text-(--ui-text-muted) line-clamp-3">{{ content.slice(-200) }}...</p>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showWorkspace = false">关闭</NButton>
          <NButton type="primary" size="small" :loading="isGenerating" :disabled="isGenerating" @click="startWorkspaceGeneration">
            {{ isGenerating ? '生成中...' : '开始生成' }}
          </NButton>
          <NButton v-if="isGenerating" size="small" type="error" @click="cancelGeneration">
            取消
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- Review Dialog -->
    <NModal v-model:show="showReviewDialog" preset="card" title="AI 多章审核" style="max-width: 800px; max-height: 85vh">
      <div class="space-y-4">
        <!-- Chapter Selection -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-medium text-(--ui-text-dimmed)">选择审核章节</label>
            <NButton size="tiny" @click="selectRecentForReview">选择最近5章</NButton>
          </div>
          <div class="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            <NTag
              v-for="ch in chapters"
              :key="ch.id"
              :type="selectedChapterIds.includes(ch.id) ? 'primary' : 'default'"
              size="small"
              checkable
              :checked="selectedChapterIds.includes(ch.id)"
              @click="toggleChapterForReview(ch.id)"
            >
              第{{ ch.chapterNumber }}章
            </NTag>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <NSwitch v-model:value="autoFix" size="small" />
          <span class="text-xs text-(--ui-text-dimmed)">自动修正（AI 将自动修复可修复的问题）</span>
        </div>

        <!-- Review Results -->
        <div v-if="reviewResult" class="space-y-3">
          <div class="flex items-center gap-3 text-sm">
            <NTag :type="reviewResult.issuesFound > 0 ? 'warning' : 'success'" size="small">
              {{ reviewResult.issuesFound > 0 ? `${reviewResult.issuesFound} 个问题` : '审核通过' }}
            </NTag>
            <span v-if="reviewResult.highSeverity" class="text-red-500 text-xs">高风险: {{ reviewResult.highSeverity }}</span>
            <span v-if="reviewResult.mediumSeverity" class="text-amber-500 text-xs">中风险: {{ reviewResult.mediumSeverity }}</span>
            <span v-if="reviewResult.lowSeverity" class="text-blue-500 text-xs">低风险: {{ reviewResult.lowSeverity }}</span>
          </div>

          <div v-if="reviewResult.issues?.length" class="space-y-2 max-h-60 overflow-y-auto">
            <div v-for="(issue, idx) in reviewResult.issues" :key="idx" class="rounded-lg bg-(--ui-bg-muted) p-3 space-y-1">
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

          <!-- Auto-fixed chapters -->
          <div v-if="reviewResult.fixedChapters?.length" class="space-y-2">
            <p class="text-xs font-medium text-(--ui-text-dimmed)">AI 自动修正：</p>
            <div v-for="fc in reviewResult.fixedChapters" :key="fc.chapterId" class="flex items-center justify-between rounded bg-(--ui-bg-muted) p-2">
              <span class="text-xs">第{{ fc.chapterNumber }}章</span>
              <NButton size="tiny" type="primary" @click="applyAutoFix(fc)">应用修正</NButton>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showReviewDialog = false">关闭</NButton>
          <NButton type="primary" size="small" :loading="isReviewing" :disabled="isReviewing || !selectedChapterIds.length" @click="startReview">
            {{ isReviewing ? '审核中...' : '开始审核' }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

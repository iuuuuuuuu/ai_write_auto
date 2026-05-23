<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  novelId: number
  chapterId: number
}>()

type ConsistencyIssueItem = {
  id: number
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  createdAt: string
}

const { data: issues, refresh } = await useFetch<ConsistencyIssueItem[]>(
  () => `/api/novels/${props.novelId}/chapters/${props.chapterId}/consistency-issues`,
  { default: () => [] }
)

async function dismissIssue(issueId: number) {
  await $fetch(
    `/api/novels/${props.novelId}/chapters/${props.chapterId}/consistency-issues/${issueId}`,
    { method: 'PUT', body: { dismissed: true } }
  )
  await refresh()
}

function severityIcon(severity: string) {
  if (severity === 'high') return 'lucide:alert-circle'
  if (severity === 'medium') return 'lucide:alert-triangle'
  return 'lucide:info'
}

function severityColor(severity: string) {
  if (severity === 'high') return 'text-red-500'
  if (severity === 'medium') return 'text-amber-500'
  return 'text-blue-400'
}

defineExpose({ refresh })
</script>

<template>
  <div class="space-y-2">
    <div v-if="issues?.length" class="space-y-1.5">
      <div
        v-for="issue in issues"
        :key="issue.id"
        class="p-2 rounded-lg bg-(--ui-bg-elevated) border border-(--ui-border) space-y-1"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <Icon
              :icon="severityIcon(issue.severity)"
              class="w-3.5 h-3.5 shrink-0"
              :class="severityColor(issue.severity)"
            />
            <span class="text-[11px] font-medium" :class="severityColor(issue.severity)">
              {{ issue.type }}
            </span>
          </div>
          <button
            class="text-[10px] text-(--ui-text-dimmed) hover:text-(--ui-text) shrink-0"
            title="忽略"
            @click="dismissIssue(issue.id)"
          >
            <Icon icon="lucide:x" class="w-3 h-3" />
          </button>
        </div>
        <p class="text-xs text-(--ui-text-muted) leading-relaxed">
          {{ issue.description }}
        </p>
      </div>
    </div>
    <div v-else class="text-center py-4">
      <Icon icon="lucide:check-circle" class="w-5 h-5 text-emerald-400 mx-auto mb-1" />
      <p class="text-xs text-(--ui-text-dimmed)">暂无一致性问题</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  novelId: number
  characterId: number | null
}>()

const emit = defineEmits<{
  refreshed: []
}>()

interface CharacterStateChangeItem {
  id: number
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  characterId: number
  characterName: string
  relatedCharacterId: number | null
  relatedCharacterName: string | null
  changeType: string
  beforeValue: string | null
  afterValue: string
  reason: string | null
  evidenceQuote: string | null
  confidence: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'reverted'
  source: 'ai' | 'manual'
  isStale: boolean
  createdAt: string
  updatedAt: string
}

const message = useMessage()
const loading = shallowRef(false)
const operatingId = shallowRef<number | null>(null)
const changes = ref<CharacterStateChangeItem[]>([])

const acceptedChanges = computed(() =>
  changes.value.filter((change) => change.status === 'accepted')
)
const pendingChanges = computed(() =>
  changes.value.filter((change) => change.status === 'pending')
)
const visibleChanges = computed(() => [
  ...pendingChanges.value,
  ...acceptedChanges.value
])

const changeTypeLabels: Record<string, string> = {
  description: '简介',
  traits: '性格',
  relationships: '关系',
  currentState: '状态',
  realName: '本名',
  displayTitle: '称呼',
  rolePosition: '身份',
  storyRole: '作用',
  overallArc: '弧线'
}

function getChangeTypeLabel(changeType: string) {
  return changeTypeLabels[changeType] || changeType
}

function getStatusType(status: CharacterStateChangeItem['status']) {
  if (status === 'accepted') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'reverted') return 'default'
  return 'error'
}

function getStatusLabel(status: CharacterStateChangeItem['status']) {
  if (status === 'accepted') return '已确认'
  if (status === 'pending') return '待确认'
  if (status === 'reverted') return '已撤销'
  return '已驳回'
}

async function fetchChanges() {
  if (!props.characterId) {
    changes.value = []
    return
  }
  loading.value = true
  try {
    changes.value = await $fetch<CharacterStateChangeItem[]>(
      `/api/novels/${props.novelId}/character-state-changes`,
      {
        query: { characterId: props.characterId }
      }
    )
  } catch {
    message.error('加载角色变化失败')
  } finally {
    loading.value = false
  }
}

async function operateChange(
  changeId: number,
  action: 'accept' | 'reject' | 'revert' | 'delete'
) {
  operatingId.value = changeId
  try {
    if (action === 'delete') {
      await $fetch(
        `/api/novels/${props.novelId}/character-state-changes/${changeId}`,
        { method: 'DELETE' }
      )
      message.success('变化记录已删除')
    } else {
      await $fetch(
        `/api/novels/${props.novelId}/character-state-changes/${changeId}/${action}`,
        { method: 'POST' }
      )
      const label =
        action === 'accept' ? '已确认'
        : action === 'reject' ? '已驳回'
        : '已撤销'
      message.success(label)
    }
    await fetchChanges()
    emit('refreshed')
  } catch {
    message.error('操作失败')
  } finally {
    operatingId.value = null
  }
}

watch(
  () => [props.novelId, props.characterId],
  () => {
    fetchChanges()
  },
  { immediate: true }
)

defineExpose({ refresh: fetchChanges })
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Icon
          icon="lucide:activity"
          class="size-4 text-primary-500"
        />
        <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">
          角色变化时间线
        </h3>
        <NTag
          v-if="pendingChanges.length"
          size="small"
          type="warning"
        >
          {{ pendingChanges.length }} 条待确认
        </NTag>
      </div>
      <NButton
        size="tiny"
        quaternary
        :loading="loading"
        @click="fetchChanges"
      >
        <template #icon><Icon icon="lucide:refresh-cw" /></template>
      </NButton>
    </div>

    <NSpin :show="loading">
      <div
        v-if="visibleChanges.length"
        class="space-y-2"
      >
        <article
          v-for="change in visibleChanges"
          :key="change.id"
          class="rounded-lg bg-(--ui-bg-muted) ring-1 ring-(--ui-border) p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <NTag
              size="small"
              :type="getStatusType(change.status)"
            >
              {{ getStatusLabel(change.status) }}
            </NTag>
            <NTag size="small">
              {{ getChangeTypeLabel(change.changeType) }}
            </NTag>
            <span class="text-xs text-(--ui-text-dimmed)">
              第{{ change.chapterNumber }}章 · {{ change.chapterTitle }}
            </span>
            <NTag
              v-if="change.isStale"
              size="small"
              type="warning"
            >
              正文已变更
            </NTag>
          </div>

          <p class="mt-2 text-sm leading-relaxed text-(--ui-text-highlighted)">
            {{ change.afterValue }}
          </p>
          <p
            v-if="change.relatedCharacterName"
            class="mt-1 text-xs text-(--ui-text-muted)"
          >
            关联角色：{{ change.relatedCharacterName }}
          </p>
          <p
            v-if="change.reason"
            class="mt-1 text-xs text-(--ui-text-muted)"
          >
            {{ change.reason }}
          </p>
          <blockquote
            v-if="change.evidenceQuote"
            class="mt-2 rounded-md bg-(--ui-bg-elevated) px-2 py-1.5 text-xs leading-relaxed text-(--ui-text-muted)"
          >
            “{{ change.evidenceQuote }}”
          </blockquote>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <NButton
              v-if="change.status === 'pending'"
              size="tiny"
              type="primary"
              :loading="operatingId === change.id"
              @click="operateChange(change.id, 'accept')"
            >
              确认
            </NButton>
            <NButton
              v-if="change.status === 'pending'"
              size="tiny"
              secondary
              :loading="operatingId === change.id"
              @click="operateChange(change.id, 'reject')"
            >
              驳回
            </NButton>
            <NButton
              v-if="change.status === 'accepted'"
              size="tiny"
              secondary
              :loading="operatingId === change.id"
              @click="operateChange(change.id, 'revert')"
            >
              撤销
            </NButton>
            <NButton
              size="tiny"
              quaternary
              type="error"
              :loading="operatingId === change.id"
              @click="operateChange(change.id, 'delete')"
            >
              删除
            </NButton>
          </div>
        </article>
      </div>

      <NEmpty
        v-else
        size="small"
        description="暂无已确认或待确认的人物变化"
      />
    </NSpin>
  </section>
</template>

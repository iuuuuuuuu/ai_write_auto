<script setup lang="ts">
const { t } = useI18n()

const days = ref(30)
const { data: usage, refresh } = await useFetch('/api/stats/token-usage', {
  query: { days }
})

const totalInput = computed(() => (usage.value as any)?.totalInput || 0)
const totalOutput = computed(() => (usage.value as any)?.totalOutput || 0)
const totalTokens = computed(() => (usage.value as any)?.totalTokens || 0)
const records = computed(() => (usage.value as any)?.usage || [])

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

watch(days, () => refresh())
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-(--ui-text-muted)">{{ t('ai.tokenUsage') }}</p>
      <div class="flex gap-1">
        <NButton
          size="tiny"
          :type="days === 7 ? 'primary' : 'default'"
          :quaternary="days !== 7"
          @click="days = 7"
          >7天</NButton
        >
        <NButton
          size="tiny"
          :type="days === 30 ? 'primary' : 'default'"
          :quaternary="days !== 30"
          @click="days = 30"
          >30天</NButton
        >
        <NButton
          size="tiny"
          :type="days === 90 ? 'primary' : 'default'"
          :quaternary="days !== 90"
          @click="days = 90"
          >90天</NButton
        >
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <div class="card-surface p-3 text-center">
        <p class="text-xl font-bold font-mono text-(--ui-text-highlighted)">
          {{ formatNumber(totalInput) }}
        </p>
        <p class="text-[11px] text-(--ui-text-dimmed) mt-1">Input Tokens</p>
      </div>
      <div class="card-surface p-3 text-center">
        <p class="text-xl font-bold font-mono text-(--ui-text-highlighted)">
          {{ formatNumber(totalOutput) }}
        </p>
        <p class="text-[11px] text-(--ui-text-dimmed) mt-1">Output Tokens</p>
      </div>
      <div class="card-surface p-3 text-center">
        <p class="text-xl font-bold font-mono text-primary-600">
          {{ formatNumber(totalTokens) }}
        </p>
        <p class="text-[11px] text-(--ui-text-dimmed) mt-1">Total</p>
      </div>
    </div>

    <div
      v-if="records.length"
      class="card-surface overflow-hidden"
    >
      <table class="w-full text-sm">
        <thead class="bg-(--ui-bg-muted)/50">
          <tr>
            <th
              class="px-3 py-2 text-left text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              日期
            </th>
            <th
              class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              Input
            </th>
            <th
              class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              Output
            </th>
            <th
              class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              {{ t('ai.estimatedCost') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--ui-border)/40">
          <tr
            v-for="record in records"
            :key="record.id"
            class="hover:bg-(--ui-bg-muted)/30 transition-colors"
          >
            <td class="px-3 py-2 text-(--ui-text) text-[12px]">
              {{ new Date(record.createdAt).toLocaleDateString() }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-(--ui-text-muted) text-[12px]"
            >
              {{ formatNumber(record.tokensInput) }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-(--ui-text-muted) text-[12px]"
            >
              {{ formatNumber(record.tokensOutput) }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-(--ui-text-muted) text-[12px]"
            >
              ${{ record.estimatedCost?.toFixed(4) || '0.0000' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState
      v-else
      icon="lucide:bar-chart-2"
      :title="t('common.noData')"
    />
  </div>
</template>

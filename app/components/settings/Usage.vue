<script setup lang="ts">
const { t } = useI18n()

const days = ref(30)
const { data: usage, refresh } = await useFetch('/api/stats/token-usage', {
  query: { days },
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
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('ai.tokenUsage') }}</p>
      <div class="flex gap-2">
        <NButton size="tiny" :type="days === 7 ? 'primary' : 'default'" :quaternary="days !== 7" @click="days = 7">7天</NButton>
        <NButton size="tiny" :type="days === 30 ? 'primary' : 'default'" :quaternary="days !== 30" @click="days = 30">30天</NButton>
        <NButton size="tiny" :type="days === 90 ? 'primary' : 'default'" :quaternary="days !== 90" @click="days = 90">90天</NButton>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatNumber(totalInput) }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Input Tokens</p>
      </div>
      <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatNumber(totalOutput) }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Output Tokens</p>
      </div>
      <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
        <p class="text-2xl font-bold text-primary-500">{{ formatNumber(totalTokens) }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</p>
      </div>
    </div>

    <div v-if="records.length" class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th class="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">日期</th>
            <th class="px-4 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Input</th>
            <th class="px-4 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Output</th>
            <th class="px-4 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">{{ t('ai.estimatedCost') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="record in records" :key="record.id">
            <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ new Date(record.createdAt).toLocaleDateString() }}</td>
            <td class="px-4 py-2 text-right text-gray-600 dark:text-gray-300">{{ formatNumber(record.tokensInput) }}</td>
            <td class="px-4 py-2 text-right text-gray-600 dark:text-gray-300">{{ formatNumber(record.tokensOutput) }}</td>
            <td class="px-4 py-2 text-right text-gray-600 dark:text-gray-300">${{ record.estimatedCost?.toFixed(4) || '0.0000' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="text-center py-8 text-gray-400">
      {{ t('common.noData') }}
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface TokenUsageItem {
  id: number
  user: { id: number; username: string } | null
  tokensInput: number
  tokensOutput: number
  estimatedCost: string | null
  createdAt: string
}

const days = ref('30')
const daysOptions = [
  { label: '最近 7 天', value: '7' },
  { label: '最近 30 天', value: '30' },
  { label: '最近 90 天', value: '90' }
]

const queryParams = computed(() => ({ days: days.value }))

const {
  items: usage,
  loading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage
} = usePagination<TokenUsageItem>({
  url: '/api/admin/token-usage',
  params: queryParams
})

const summary = ref({
  totalInput: 0,
  totalOutput: 0,
  totalTokens: 0,
  totalCost: '0',
  totalRecords: 0
})

watch(
  [usage, days],
  async () => {
    const data = await $fetch<any>('/api/admin/token-usage', {
      params: { days: days.value, page: 1, pageSize: 1 }
    })
    if (data.summary) summary.value = data.summary
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin / Token Usage</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          Token 用量
        </h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">
          跨用户 token 消耗统计。
        </p>
      </div>
      <NSelect
        v-model:value="days"
        :options="daysOptions"
        class="w-40"
      />
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="card-surface p-3">
        <div class="flex items-center gap-2">
          <div
            class="flex size-6 items-center justify-center rounded-md bg-primary-400/10"
          >
            <Icon
              icon="lucide:hash"
              class="size-3.5 text-primary-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">总 Token</p>
        </div>
        <p
          class="text-xl font-bold font-mono text-(--ui-text-highlighted) mt-1"
        >
          {{ summary.totalTokens.toLocaleString() }}
        </p>
      </div>
      <div class="card-surface p-3">
        <div class="flex items-center gap-2">
          <div
            class="flex size-6 items-center justify-center rounded-md bg-blue-400/10"
          >
            <Icon
              icon="lucide:arrow-down"
              class="size-3.5 text-blue-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">输入</p>
        </div>
        <p
          class="text-xl font-bold font-mono text-(--ui-text-highlighted) mt-1"
        >
          {{ summary.totalInput.toLocaleString() }}
        </p>
      </div>
      <div class="card-surface p-3">
        <div class="flex items-center gap-2">
          <div
            class="flex size-6 items-center justify-center rounded-md bg-emerald-400/10"
          >
            <Icon
              icon="lucide:arrow-up"
              class="size-3.5 text-emerald-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">输出</p>
        </div>
        <p
          class="text-xl font-bold font-mono text-(--ui-text-highlighted) mt-1"
        >
          {{ summary.totalOutput.toLocaleString() }}
        </p>
      </div>
      <div class="card-surface p-3">
        <div class="flex items-center gap-2">
          <div
            class="flex size-6 items-center justify-center rounded-md bg-amber-400/10"
          >
            <Icon
              icon="lucide:dollar-sign"
              class="size-3.5 text-amber-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">预估费用</p>
        </div>
        <p
          class="text-xl font-bold font-mono text-(--ui-text-highlighted) mt-1"
        >
          ${{ summary.totalCost }}
        </p>
      </div>
    </div>

    <!-- Usage List -->
    <div
      v-if="loading"
      class="space-y-3"
    >
      <NSkeleton
        v-for="i in 6"
        :key="i"
        class="h-12 rounded-lg"
        text
      />
    </div>
    <div
      v-else-if="!usage.length"
      class="card-surface p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无用量记录
    </div>
    <template v-else>
      <div class="card-surface overflow-hidden">
        <div class="divide-y divide-(--ui-border)/40">
          <div
            v-for="item in usage"
            :key="item.id"
            class="grid gap-2 p-3 md:grid-cols-[1fr_100px_100px_80px_160px] md:items-center"
          >
            <div>
              <NuxtLink
                v-if="item.user"
                :to="`/admin/users/${item.user.id}`"
                class="text-sm font-medium text-primary-400 hover:text-primary-300"
              >
                {{ item.user.username }}
              </NuxtLink>
              <span
                v-else
                class="text-sm text-(--ui-text-muted)"
                >未知用户</span
              >
            </div>
            <span class="text-sm text-(--ui-text-muted)"
              >{{ item.tokensInput.toLocaleString() }} in</span
            >
            <span class="text-sm text-(--ui-text-muted)"
              >{{ item.tokensOutput.toLocaleString() }} out</span
            >
            <span class="text-sm text-(--ui-text-dimmed)"
              >${{ item.estimatedCost || '0' }}</span
            >
            <span class="text-xs text-(--ui-text-dimmed)">{{
              new Date(item.createdAt).toLocaleString()
            }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between pt-2"
      >
        <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
        <NPagination
          :page="page"
          :page-count="totalPages"
          :page-size="pageSize"
          @update:page="goToPage"
        />
      </div>
    </template>
  </div>
</template>

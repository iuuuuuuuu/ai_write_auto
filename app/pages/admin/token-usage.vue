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

interface TokenUsageSummary {
  totalInput: number
  totalOutput: number
  totalTokens: number
  totalCost: string
  totalRecords: number
}

interface TokenUsageResponse {
  summary?: TokenUsageSummary
}

const days = shallowRef('30')
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
    const data = await $fetch<TokenUsageResponse>('/api/admin/token-usage', {
      params: { days: days.value, page: 1, pageSize: 1 }
    })
    if (data.summary) summary.value = data.summary
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">Admin / Token Usage</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-[-0.05em] text-(--ui-text-highlighted)">
            Token 用量
          </h1>
          <p class="mt-3 text-sm text-(--ui-text-muted)">
            跨用户 token 消耗统计。
          </p>
        </div>
        <NSelect
          v-model:value="days"
          :options="daysOptions"
          class="w-40"
        />
      </div>
    </section>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-primary-400/10">
            <Icon
              icon="lucide:hash"
              class="size-3.5 text-primary-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">总 Token</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalTokens.toLocaleString() }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-blue-400/10">
            <Icon
              icon="lucide:arrow-down"
              class="size-3.5 text-blue-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">输入</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalInput.toLocaleString() }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-emerald-400/10">
            <Icon
              icon="lucide:arrow-up"
              class="size-3.5 text-emerald-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">输出</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalOutput.toLocaleString() }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-amber-400/10">
            <Icon
              icon="lucide:dollar-sign"
              class="size-3.5 text-amber-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">预估费用</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          ${{ summary.totalCost }}
        </p>
      </div>
    </div>

    <div
      v-if="loading"
      class="space-y-3"
    >
      <NSkeleton
        v-for="i in 6"
        :key="i"
        class="h-12 rounded-[1.2rem]"
        text
      />
    </div>
    <div
      v-else-if="!usage.length"
      class="card-glass p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无用量记录
    </div>
    <template v-else>
      <div class="card-glass overflow-hidden p-2">
        <div class="space-y-2">
          <article
            v-for="item in usage"
            :key="item.id"
            class="liquid-panel grid gap-2 p-3 md:grid-cols-[1fr_100px_100px_80px_160px] md:items-center"
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
          </article>
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

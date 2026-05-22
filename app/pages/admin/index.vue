<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminOverview {
  users: { total: number; admins: number; regular: number }
  novels: {
    total: number
    draft: number
    inProgress: number
    completed: number
  }
  aiConfigs: { total: number; enabled: number; disabled: number }
  usage: { requests: number; totalTokens: number }
}

const {
  data: overview,
  pending,
  error
} = await useFetch<AdminOverview>('/api/admin/overview')

const metrics = computed(() => [
  {
    label: '用户总数',
    value: overview.value?.users.total || 0,
    detail: `${overview.value?.users.admins || 0} 个管理员`,
    icon: 'lucide:users'
  },
  {
    label: '小说总数',
    value: overview.value?.novels.total || 0,
    detail: `${overview.value?.novels.inProgress || 0} 本连载中`,
    icon: 'lucide:library'
  },
  {
    label: '模型配置',
    value: overview.value?.aiConfigs.total || 0,
    detail: `${overview.value?.aiConfigs.enabled || 0} 个可用`,
    icon: 'lucide:cpu'
  },
  {
    label: 'Token 用量',
    value: overview.value?.usage.totalTokens || 0,
    detail: `${overview.value?.usage.requests || 0} 次记录`,
    icon: 'lucide:activity'
  }
])
</script>

<template>
  <div class="space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <span class="liquid-orb -right-10 -top-14 h-40 w-40" />
      <span class="liquid-highlight left-8 top-4 h-10 w-64 rotate-[-8deg]" />

      <div class="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">Admin command</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-[-0.05em] text-(--ui-text-highlighted)">
            管理概览
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-(--ui-text-muted)">
            查看平台用户、小说、模型配置和基础用量，快速进入运营查阅流程。
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <NButton
            type="primary"
            round
            @click="navigateTo('/admin/users')"
          >
            <template #icon>
              <Icon icon="lucide:users" />
            </template>
            用户管理
          </NButton>
          <NButton
            secondary
            round
            @click="navigateTo('/admin/novels')"
          >
            <template #icon>
              <Icon icon="lucide:library" />
            </template>
            小说查阅
          </NButton>
        </div>
      </div>
    </section>

    <div
      v-if="pending"
      class="grid gap-3 md:grid-cols-4"
    >
      <NSkeleton
        v-for="item in 4"
        :key="item"
        class="h-28 rounded-[1.5rem]"
        text
      />
    </div>

    <NAlert
      v-else-if="error"
      type="error"
      title="后台数据加载失败"
    >
      请稍后重试，或检查当前账号是否仍拥有管理员权限。
    </NAlert>

    <div
      v-else
      class="grid gap-3 md:grid-cols-4"
    >
      <section
        v-for="(metric, idx) in metrics"
        :key="metric.label"
        class="liquid-panel group relative overflow-hidden p-4"
        :style="{ animationDelay: `${idx * 60}ms` }"
      >
        <span class="liquid-highlight -right-5 top-0 h-8 w-28 rotate-[-10deg] opacity-0 transition-opacity group-hover:opacity-60" />
        <div class="relative z-10 flex items-center justify-between gap-3">
          <p class="text-xs uppercase tracking-[0.18em] text-(--ui-text-dimmed)">
            {{ metric.label }}
          </p>
          <div class="flex size-9 items-center justify-center rounded-2xl bg-primary-500/12 ring-1 ring-white/15">
            <Icon
              :icon="metric.icon"
              class="size-4 text-primary-500"
            />
          </div>
        </div>
        <p class="relative z-10 mt-4 font-mono text-2xl font-semibold text-(--ui-text-highlighted)">
          {{ metric.value.toLocaleString() }}
        </p>
        <p class="relative z-10 mt-1 text-xs text-(--ui-text-muted)">{{ metric.detail }}</p>
      </section>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <section class="card-glass p-5">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="liquid-panel flex size-10 items-center justify-center rounded-[1.2rem]">
              <Icon
                icon="lucide:book-open"
                class="size-4.5 text-amber-500"
              />
            </div>
            <div>
              <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
                平台内容状态
              </h2>
              <p class="text-xs text-(--ui-text-muted)">
                当前小说状态分布，用于判断创作活跃度
              </p>
            </div>
          </div>
          <NButton
            quaternary
            size="small"
            round
            @click="navigateTo('/admin/novels')"
          >
            <template #icon>
              <Icon icon="lucide:arrow-right" />
            </template>
            查看
          </NButton>
        </div>
        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div class="liquid-panel p-4 text-center">
            <p class="text-xs text-(--ui-text-dimmed)">草稿</p>
            <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
              {{ overview?.novels.draft || 0 }}
            </p>
          </div>
          <div class="liquid-panel p-4 text-center">
            <p class="text-xs text-(--ui-text-dimmed)">连载中</p>
            <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
              {{ overview?.novels.inProgress || 0 }}
            </p>
          </div>
          <div class="liquid-panel p-4 text-center">
            <p class="text-xs text-(--ui-text-dimmed)">已完结</p>
            <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
              {{ overview?.novels.completed || 0 }}
            </p>
          </div>
        </div>
      </section>

      <section class="card-glass p-5">
        <div class="flex items-center gap-3">
          <div class="liquid-panel flex size-10 items-center justify-center rounded-[1.2rem]">
            <Icon
              icon="lucide:cpu"
              class="size-4.5 text-primary-500"
            />
          </div>
          <div>
            <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
              模型配置健康度
            </h2>
            <p class="text-xs text-(--ui-text-muted)">密钥仅显示遮蔽结果</p>
          </div>
        </div>
        <div class="mt-5 space-y-2.5">
          <div class="liquid-panel flex items-center justify-between px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="size-2 rounded-full bg-emerald-400" />
              <span class="text-sm text-(--ui-text-muted)">可用配置</span>
            </div>
            <span class="font-mono font-semibold">{{
              overview?.aiConfigs.enabled || 0
            }}</span>
          </div>
          <div class="liquid-panel flex items-center justify-between px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="size-2 rounded-full bg-amber-400" />
              <span class="text-sm text-(--ui-text-muted)">停用配置</span>
            </div>
            <span class="font-mono font-semibold">{{
              overview?.aiConfigs.disabled || 0
            }}</span>
          </div>
          <NButton
            block
            secondary
            round
            @click="navigateTo('/admin/ai-configs')"
          >
            <template #icon>
              <Icon icon="lucide:cpu" />
            </template>
            查看模型配置
          </NButton>
        </div>
      </section>
    </div>
  </div>
</template>

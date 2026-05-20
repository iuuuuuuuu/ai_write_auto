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
  <div class="space-y-4">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          管理概览
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-(--ui-text-muted)">
          查看平台用户、小说、模型配置和基础用量，快速进入运营查阅流程。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NButton type="primary" @click="navigateTo('/admin/users')">
          <template #icon>
            <Icon icon="lucide:users" />
          </template>
          用户管理
        </NButton>
        <NButton secondary @click="navigateTo('/admin/novels')">
          <template #icon>
            <Icon icon="lucide:library" />
          </template>
          小说查阅
        </NButton>
      </div>
    </div>

    <div
      v-if="pending"
      class="grid gap-3 md:grid-cols-4"
    >
      <NSkeleton
        v-for="item in 4"
        :key="item"
        class="h-28 rounded-lg"
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
        v-for="metric in metrics"
        :key="metric.label"
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4 transition-colors hover:bg-(--ui-bg-elevated)"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-(--ui-text-muted)">{{ metric.label }}</p>
          <Icon
            :icon="metric.icon"
            class="size-4 text-primary-400"
          />
        </div>
        <p class="mt-4 text-2xl font-semibold text-(--ui-text-highlighted)">
          {{ metric.value.toLocaleString() }}
        </p>
        <p class="mt-1 text-xs text-(--ui-text-dimmed)">{{ metric.detail }}</p>
      </section>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <section
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
              平台内容状态
            </h2>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              当前小说状态分布，用于判断创作活跃度。
            </p>
          </div>
          <NButton quaternary size="small" @click="navigateTo('/admin/novels')">
            <template #icon>
              <Icon icon="lucide:arrow-right" />
            </template>
            查看
          </NButton>
        </div>
        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg bg-(--ui-bg-elevated) p-4">
            <p class="text-xs text-(--ui-text-dimmed)">草稿</p>
            <p class="mt-2 text-xl font-semibold">
              {{ overview?.novels.draft || 0 }}
            </p>
          </div>
          <div class="rounded-lg bg-(--ui-bg-elevated) p-4">
            <p class="text-xs text-(--ui-text-dimmed)">连载中</p>
            <p class="mt-2 text-xl font-semibold">
              {{ overview?.novels.inProgress || 0 }}
            </p>
          </div>
          <div class="rounded-lg bg-(--ui-bg-elevated) p-4">
            <p class="text-xs text-(--ui-text-dimmed)">已完结</p>
            <p class="mt-2 text-xl font-semibold">
              {{ overview?.novels.completed || 0 }}
            </p>
          </div>
        </div>
      </section>

      <section
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div>
          <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
            模型配置健康度
          </h2>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            管理员可查阅用户配置的模型，但不会看到明文密钥。
          </p>
        </div>
        <div class="mt-5 space-y-3">
          <div
            class="flex items-center justify-between rounded-lg bg-(--ui-bg-elevated) p-3"
          >
            <span class="text-sm text-(--ui-text-muted)">可用配置</span>
            <span class="font-semibold">{{
              overview?.aiConfigs.enabled || 0
            }}</span>
          </div>
          <div
            class="flex items-center justify-between rounded-lg bg-(--ui-bg-elevated) p-3"
          >
            <span class="text-sm text-(--ui-text-muted)">停用配置</span>
            <span class="font-semibold">{{
              overview?.aiConfigs.disabled || 0
            }}</span>
          </div>
          <NButton block secondary @click="navigateTo('/admin/ai-configs')">
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

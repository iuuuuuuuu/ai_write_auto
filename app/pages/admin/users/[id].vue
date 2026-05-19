<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminUserDetail {
  user: {
    id: number
    username: string
    role: 'admin' | 'user'
    createdAt: string
  }
  aiConfigs: Array<{
    id: number
    name: string
    purpose: string
    apiUrl: string
    model: string
    temperature: string | null
    maxTokens: number | null
    isDefault: boolean
    enabled: boolean
    maskedApiKey: string
  }>
  novels: Array<{
    id: number
    title: string
    description: string | null
    genre: string | null
    status: 'draft' | 'in_progress' | 'completed'
    updatedAt: string
  }>
  stats: {
    novels: number
    deletedNovels: number
    aiConfigs: number
    enabledAiConfigs: number
    tokenRequests: number
    totalTokens: number
  }
}

const route = useRoute()
const userId = computed(() => Number(route.params.id))

const {
  data: detail,
  pending,
  error,
  refresh
} = await useFetch<AdminUserDetail>(() => `/api/admin/users/${userId.value}`)

const savingRole = ref(false)

const roleItems = [
  { label: '用户', value: 'user' },
  { label: '管理员', value: 'admin' }
]

async function updateRole(role: 'admin' | 'user') {
  if (
    !detail.value ||
    detail.value.user.id === 1 ||
    role === detail.value.user.role
  )
    return

  savingRole.value = true
  try {
    await $fetch(`/api/admin/users/${detail.value.user.id}`, {
      method: 'PUT',
      body: { role }
    })
    await refresh()
  } finally {
    savingRole.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <UButton
      to="/admin/users"
      variant="ghost"
      color="neutral"
      icon="i-lucide-arrow-left"
    >
      返回用户列表
    </UButton>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="用户详情加载失败"
    />

    <div
      v-else-if="pending"
      class="space-y-4"
    >
      <USkeleton class="h-28 rounded-lg" />
      <USkeleton class="h-64 rounded-lg" />
    </div>

    <template v-else-if="detail">
      <section
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <p class="text-sm text-(--ui-text-muted)">
              User #{{ detail.user.id }}
            </p>
            <h1
              class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)"
            >
              {{ detail.user.username }}
            </h1>
            <p class="mt-2 text-sm text-(--ui-text-muted)">
              创建于 {{ new Date(detail.user.createdAt).toLocaleString() }}
            </p>
          </div>
          <div class="w-full sm:w-56">
            <label class="mb-1 block text-sm text-(--ui-text-muted)"
              >角色</label
            >
            <USelectMenu
              :model-value="detail.user.role"
              :items="roleItems"
              value-key="value"
              :disabled="detail.user.id === 1 || savingRole"
              @update:model-value="updateRole"
            />
          </div>
        </div>
      </section>

      <div class="grid gap-3 md:grid-cols-4">
        <section
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4"
        >
          <p class="text-sm text-(--ui-text-muted)">小说</p>
          <p class="mt-3 text-2xl font-semibold">{{ detail.stats.novels }}</p>
        </section>
        <section
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4"
        >
          <p class="text-sm text-(--ui-text-muted)">模型配置</p>
          <p class="mt-3 text-2xl font-semibold">
            {{ detail.stats.aiConfigs }}
          </p>
        </section>
        <section
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4"
        >
          <p class="text-sm text-(--ui-text-muted)">可用模型</p>
          <p class="mt-3 text-2xl font-semibold">
            {{ detail.stats.enabledAiConfigs }}
          </p>
        </section>
        <section
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4"
        >
          <p class="text-sm text-(--ui-text-muted)">Token</p>
          <p class="mt-3 text-2xl font-semibold">
            {{ detail.stats.totalTokens.toLocaleString() }}
          </p>
        </section>
      </div>

      <section
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold text-(--ui-text-highlighted)">模型配置</h2>
          <UBadge variant="subtle">{{ detail.aiConfigs.length }}</UBadge>
        </div>
        <div
          v-if="!detail.aiConfigs.length"
          class="py-8 text-center text-sm text-(--ui-text-muted)"
        >
          该用户还没有配置模型
        </div>
        <div
          v-else
          class="divide-y divide-(--ui-border)"
        >
          <div
            v-for="config in detail.aiConfigs"
            :key="config.id"
            class="grid gap-3 py-4 lg:grid-cols-[1fr_180px_160px] lg:items-center"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-(--ui-text-highlighted)">
                  {{ config.name }}
                </p>
                <UBadge
                  v-if="config.isDefault"
                  size="xs"
                  variant="subtle"
                >
                  默认
                </UBadge>
                <UBadge
                  :color="config.enabled ? 'success' : 'neutral'"
                  size="xs"
                  variant="subtle"
                >
                  {{ config.enabled ? '启用' : '停用' }}
                </UBadge>
              </div>
              <p class="mt-1 truncate text-sm text-(--ui-text-muted)">
                {{ config.apiUrl }}
              </p>
              <p class="mt-1 text-xs text-(--ui-text-dimmed)">
                Key {{ config.maskedApiKey }}
              </p>
            </div>
            <p class="text-sm text-(--ui-text-muted)">{{ config.model }}</p>
            <p class="text-sm text-(--ui-text-muted)">{{ config.purpose }}</p>
          </div>
        </div>
      </section>

      <section
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold text-(--ui-text-highlighted)">小说</h2>
          <UBadge variant="subtle">{{ detail.novels.length }}</UBadge>
        </div>
        <div
          v-if="!detail.novels.length"
          class="py-8 text-center text-sm text-(--ui-text-muted)"
        >
          该用户还没有创建小说
        </div>
        <div
          v-else
          class="divide-y divide-(--ui-border)"
        >
          <div
            v-for="novel in detail.novels"
            :key="novel.id"
            class="grid gap-3 py-4 md:grid-cols-[1fr_120px_150px_90px] md:items-center"
          >
            <div class="min-w-0">
              <NuxtLink
                :to="`/admin/novels/${novel.id}`"
                class="font-medium hover:text-primary-400"
              >
                {{ novel.title }}
              </NuxtLink>
              <p class="mt-1 line-clamp-1 text-sm text-(--ui-text-muted)">
                {{ novel.description || '暂无简介' }}
              </p>
            </div>
            <UBadge variant="subtle">{{ novel.status }}</UBadge>
            <p class="text-sm text-(--ui-text-muted)">
              {{ new Date(novel.updatedAt).toLocaleDateString() }}
            </p>
            <UButton
              :to="`/admin/novels/${novel.id}`"
              size="sm"
              variant="outline"
              icon="i-lucide-eye"
            >
              查阅
            </UButton>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

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

const savingRole = shallowRef(false)

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
    <NButton
      quaternary
      @click="navigateTo('/admin/users')"
    >
      <template #icon>
        <Icon icon="lucide:arrow-left" />
      </template>
      返回用户列表
    </NButton>

    <NAlert
      v-if="error"
      type="error"
      title="用户详情加载失败"
    />

    <div
      v-else-if="pending"
      class="space-y-4"
    >
      <NSkeleton
        class="h-28 rounded-lg"
        text
      />
      <NSkeleton
        class="h-64 rounded-lg"
        text
      />
    </div>

    <template v-else-if="detail">
      <section class="card-glass relative overflow-hidden p-5">
        <div class="liquid-orb -right-16 -top-20 h-44 w-44 bg-primary-400/20" />
        <div class="liquid-highlight" />
        <div
          class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="flex items-center gap-4">
            <div
              class="liquid-panel flex size-12 items-center justify-center text-xl font-semibold text-primary-500"
            >
              {{ detail.user.username.charAt(0).toUpperCase() }}
            </div>
            <div>
              <p class="text-xs text-(--ui-text-dimmed)">
                User #{{ detail.user.id }}
              </p>
              <h1 class="text-xl font-bold text-(--ui-text-highlighted)">
                {{ detail.user.username }}
              </h1>
              <p class="text-xs text-(--ui-text-muted)">
                创建于 {{ new Date(detail.user.createdAt).toLocaleString() }}
              </p>
            </div>
          </div>
          <div class="w-full sm:w-56">
            <label class="mb-1 block text-xs text-(--ui-text-muted)"
              >角色</label
            >
            <NSelect
              :value="detail.user.role"
              :options="roleItems"
              :disabled="detail.user.id === 1 || savingRole"
              @update:value="updateRole"
            />
          </div>
        </div>
      </section>

      <div class="grid gap-3 md:grid-cols-4">
        <section class="liquid-panel p-4">
          <p class="text-xs text-(--ui-text-dimmed)">小说</p>
          <p class="mt-2 font-mono text-2xl font-semibold">
            {{ detail.stats.novels }}
          </p>
        </section>
        <section class="liquid-panel p-4">
          <p class="text-xs text-(--ui-text-dimmed)">模型配置</p>
          <p class="mt-2 font-mono text-2xl font-semibold">
            {{ detail.stats.aiConfigs }}
          </p>
        </section>
        <section class="liquid-panel p-4">
          <p class="text-xs text-(--ui-text-dimmed)">可用模型</p>
          <p class="mt-2 font-mono text-2xl font-semibold">
            {{ detail.stats.enabledAiConfigs }}
          </p>
        </section>
        <section class="liquid-panel p-4">
          <p class="text-xs text-(--ui-text-dimmed)">Token</p>
          <p class="mt-2 font-mono text-2xl font-semibold">
            {{ detail.stats.totalTokens.toLocaleString() }}
          </p>
        </section>
      </div>

      <section class="card-glass p-5">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon
              icon="lucide:cpu"
              class="size-4 text-primary-500"
            />
            <h2 class="font-semibold text-(--ui-text-highlighted)">模型配置</h2>
          </div>
          <NTag size="small">{{ detail.aiConfigs.length }}</NTag>
        </div>
        <div
          v-if="!detail.aiConfigs.length"
          class="py-8 text-center text-sm text-(--ui-text-muted)"
        >
          该用户还没有配置模型
        </div>
        <div
          v-else
          class="space-y-2"
        >
          <div
            v-for="config in detail.aiConfigs"
            :key="config.id"
            class="grid gap-3 rounded-2xl bg-white/12 px-3 py-4 ring-1 ring-white/12 lg:grid-cols-[1fr_180px_160px] lg:items-center dark:bg-white/6"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-(--ui-text-highlighted)">
                  {{ config.name }}
                </p>
                <NTag
                  v-if="config.isDefault"
                  size="small"
                >
                  默认
                </NTag>
                <NTag
                  :type="config.enabled ? 'success' : 'default'"
                  size="small"
                >
                  {{ config.enabled ? '启用' : '停用' }}
                </NTag>
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

      <section class="card-glass p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold text-(--ui-text-highlighted)">小说</h2>
          <NTag size="small">{{ detail.novels.length }}</NTag>
        </div>
        <div
          v-if="!detail.novels.length"
          class="py-8 text-center text-sm text-(--ui-text-muted)"
        >
          该用户还没有创建小说
        </div>
        <div
          v-else
          class="space-y-2"
        >
          <div
            v-for="novel in detail.novels"
            :key="novel.id"
            class="grid gap-3 rounded-2xl bg-white/12 px-3 py-4 ring-1 ring-white/12 md:grid-cols-[1fr_120px_150px_90px] md:items-center dark:bg-white/6"
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
            <NTag size="small">{{ novel.status }}</NTag>
            <p class="text-sm text-(--ui-text-muted)">
              {{ new Date(novel.updatedAt).toLocaleDateString() }}
            </p>
            <NButton
              size="small"
              secondary
              round
              @click="navigateTo(`/admin/novels/${novel.id}`)"
            >
              <template #icon>
                <Icon icon="lucide:eye" />
              </template>
              查阅
            </NButton>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

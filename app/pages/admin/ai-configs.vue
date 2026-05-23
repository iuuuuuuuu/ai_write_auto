<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminAiConfig {
  id: number
  userId: number
  user: { id: number; username: string; role: string } | null
  name: string
  purpose: string
  apiUrl: string
  model: string
  temperature: string | null
  maxTokens: number | null
  isDefault: boolean
  enabled: boolean
  maskedApiKey: string
  updatedAt: string
}

const search = shallowRef('')

const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (search.value.trim()) params.search = search.value.trim()
  return params
})

const {
  items: configs,
  loading: pending,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  refresh
} = usePagination<AdminAiConfig>({
  url: '/api/admin/ai-configs',
  params: queryParams
})

const { confirmDelete } = useConfirmDialog()

async function toggleEnabled(config: AdminAiConfig) {
  await $fetch(`/api/admin/ai-configs/${config.id}`, {
    method: 'PUT',
    body: { enabled: !config.enabled }
  })
  refresh()
}

async function deleteConfig(config: AdminAiConfig) {
  const confirmed = await confirmDelete(config.name)
  if (!confirmed) return
  await $fetch(`/api/admin/ai-configs/${config.id}`, { method: 'DELETE' })
  refresh()
}
</script>

<template>
  <div class="space-y-4">
    <section class="card-glass relative overflow-hidden p-5 md:p-6">
      <div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm text-(--ui-text-muted)">Admin / AI</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)">
            模型配置
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-(--ui-text-muted)">
            查阅用户配置的模型、用途和启用状态。密钥仅显示遮蔽结果。
          </p>
        </div>
        <NInput
          v-model:value="search"
          class="sm:w-80"
          placeholder="搜索用户、模型或地址"
          clearable
        >
          <template #prefix>
            <Icon
              icon="lucide:search"
              class="text-(--ui-text-dimmed)"
            />
          </template>
        </NInput>
      </div>
    </section>

    <div
      v-if="pending"
      class="space-y-3"
    >
      <NSkeleton
        v-for="item in 6"
        :key="item"
        class="h-24 rounded-lg"
        text
      />
    </div>
    <div
      v-else-if="!configs.length"
      class="card-glass p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无匹配模型配置
    </div>
    <template v-else>
      <div class="grid gap-3">
        <section
          v-for="config in configs"
          :key="config.id"
          class="liquid-panel group p-4"
        >
          <div
            class="grid gap-4 lg:grid-cols-[1fr_220px_160px] lg:items-center"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="font-semibold text-(--ui-text-highlighted)">
                  {{ config.name }}
                </h2>
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
              <p class="mt-2 truncate text-sm text-(--ui-text-muted)">
                {{ config.apiUrl }}
              </p>
              <p class="mt-1 text-xs text-(--ui-text-dimmed)">
                Key {{ config.maskedApiKey }}
              </p>
            </div>
            <div>
              <p class="text-xs text-(--ui-text-dimmed)">模型</p>
              <p class="mt-1 text-sm text-(--ui-text-highlighted)">
                {{ config.model }}
              </p>
            </div>
            <div class="lg:text-right">
              <p class="text-xs text-(--ui-text-dimmed)">用户</p>
              <NuxtLink
                v-if="config.user"
                :to="`/admin/users/${config.user.id}`"
                class="mt-1 inline-block text-sm text-primary-400 hover:text-primary-300"
              >
                {{ config.user.username }}
              </NuxtLink>
              <p
                v-else
                class="mt-1 text-sm text-(--ui-text-muted)"
              >
                未知用户
              </p>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between">
            <div class="flex flex-wrap gap-2 text-xs text-(--ui-text-muted)">
              <span class="rounded-full bg-(--ui-bg-muted) px-2 py-1 ring-1 ring-(--ui-border)">{{
                config.purpose
              }}</span>
              <span class="rounded-full bg-(--ui-bg-muted) px-2 py-1 ring-1 ring-(--ui-border)"
                >Temperature {{ config.temperature || '未设置' }}</span
              >
              <span class="rounded-full bg-(--ui-bg-muted) px-2 py-1 ring-1 ring-(--ui-border)"
                >Max {{ config.maxTokens || '未设置' }}</span
              >
            </div>
            <div class="flex gap-1">
              <NButton
                size="small"
                :type="config.enabled ? 'default' : 'primary'"
                quaternary
                round
                @click="toggleEnabled(config)"
              >
                {{ config.enabled ? '停用' : '启用' }}
              </NButton>
              <NButton
                size="small"
                quaternary
                circle
                type="error"
                @click="deleteConfig(config)"
              >
                <template #icon><Icon icon="lucide:trash-2" /></template>
              </NButton>
            </div>
          </div>
        </section>
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

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminUser {
  id: number
  username: string
  role: 'admin' | 'user'
  createdAt: string
}

const {
  data: users,
  pending,
  error,
  refresh
} = await useFetch<AdminUser[]>('/api/admin/users', { default: () => [] })

const search = ref('')
const deletingId = ref<number | null>(null)

const filteredUsers = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return users.value

  return users.value.filter((user) =>
    user.username.toLowerCase().includes(keyword)
  )
})

async function deleteUser(user: AdminUser) {
  if (user.id === 1) return

  deletingId.value = user.id
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin / Users</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          用户管理
        </h1>
        <p class="mt-2 text-sm text-(--ui-text-muted)">
          查阅用户的模型配置、小说和基础权限。
        </p>
      </div>
      <UInput
        v-model="search"
        class="sm:w-72"
        icon="i-lucide-search"
        placeholder="搜索用户名"
      />
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="用户列表加载失败"
    />

    <div
      class="overflow-hidden rounded-lg border border-(--ui-border) bg-(--ui-bg-muted)"
    >
      <div
        v-if="pending"
        class="space-y-2 p-4"
      >
        <USkeleton
          v-for="item in 6"
          :key="item"
          class="h-12 rounded-md"
        />
      </div>
      <div
        v-else-if="!filteredUsers.length"
        class="p-10 text-center text-sm text-(--ui-text-muted)"
      >
        暂无匹配用户
      </div>
      <div
        v-else
        class="divide-y divide-(--ui-border)"
      >
        <div
          v-for="item in filteredUsers"
          :key="item.id"
          class="grid gap-3 p-4 transition-colors hover:bg-(--ui-bg-elevated) md:grid-cols-[1fr_130px_180px_220px] md:items-center"
        >
          <div class="min-w-0">
            <NuxtLink
              :to="`/admin/users/${item.id}`"
              class="font-medium text-(--ui-text-highlighted) hover:text-primary-400"
            >
              {{ item.username }}
            </NuxtLink>
            <p class="mt-1 text-xs text-(--ui-text-dimmed)">ID {{ item.id }}</p>
          </div>
          <UBadge
            :color="item.role === 'admin' ? 'primary' : 'neutral'"
            variant="subtle"
          >
            {{ item.role === 'admin' ? '管理员' : '用户' }}
          </UBadge>
          <p class="text-sm text-(--ui-text-muted)">
            {{ new Date(item.createdAt).toLocaleString() }}
          </p>
          <div class="flex flex-wrap gap-2 md:justify-end">
            <UButton
              :to="`/admin/users/${item.id}`"
              size="sm"
              variant="outline"
              icon="i-lucide-eye"
            >
              查阅
            </UButton>
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :disabled="item.id === 1"
              :loading="deletingId === item.id"
              @click="deleteUser(item)"
            >
              删除
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

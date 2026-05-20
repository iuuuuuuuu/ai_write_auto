<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminUser {
  id: number
  username: string
  role: 'admin' | 'user'
  createdAt: string
}

const search = ref('')
const deletingId = ref<number | null>(null)
const { confirmDelete } = useConfirmDialog()

const queryParams = computed(() => {
  const p: Record<string, any> = {}
  if (search.value.trim()) p.search = search.value.trim()
  return p
})

const {
  items: users,
  loading: pending,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  refresh,
} = usePagination<AdminUser>({
  url: '/api/admin/users',
  params: queryParams,
})

// Create user
const showCreateModal = ref(false)
const newUsername = ref('')
const newPassword = ref('')
const newRole = ref('user')
const creating = ref(false)

async function createUser() {
  if (!newUsername.value.trim() || !newPassword.value) return
  creating.value = true
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: { username: newUsername.value.trim(), password: newPassword.value, role: newRole.value },
    })
    showCreateModal.value = false
    newUsername.value = ''
    newPassword.value = ''
    newRole.value = 'user'
    refresh()
  } finally {
    creating.value = false
  }
}

async function deleteUser(user: AdminUser) {
  if (user.id === 1) return
  const confirmed = await confirmDelete(user.username)
  if (!confirmed) return

  deletingId.value = user.id
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    refresh()
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin / Users</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          用户管理
        </h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">
          查阅用户的模型配置、小说和基础权限。
        </p>
      </div>
      <div class="flex gap-2">
        <NInput
          v-model:value="search"
          class="sm:w-60"
          placeholder="搜索用户名"
          clearable
        >
          <template #prefix>
            <Icon icon="lucide:search" class="text-(--ui-text-dimmed)" />
          </template>
        </NInput>
        <NButton type="primary" @click="showCreateModal = true">
          <template #icon><Icon icon="lucide:plus" /></template>
          创建用户
        </NButton>
      </div>
    </div>

    <div
      class="overflow-hidden rounded-lg border border-(--ui-border) bg-(--ui-bg-muted)"
    >
      <div
        v-if="pending"
        class="space-y-2 p-4"
      >
        <NSkeleton
          v-for="item in 6"
          :key="item"
          class="h-12 rounded-md"
          text
        />
      </div>
      <div
        v-else-if="!users.length"
        class="p-10 text-center text-sm text-(--ui-text-muted)"
      >
        暂无匹配用户
      </div>
      <div
        v-else
        class="divide-y divide-(--ui-border)"
      >
        <div
          v-for="item in users"
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
          <NTag
            :type="item.role === 'admin' ? 'info' : 'default'"
          >
            {{ item.role === 'admin' ? '管理员' : '用户' }}
          </NTag>
          <p class="text-sm text-(--ui-text-muted)">
            {{ new Date(item.createdAt).toLocaleString() }}
          </p>
          <div class="flex flex-wrap gap-2 md:justify-end">
            <NButton
              size="small"
              secondary
              @click="navigateTo(`/admin/users/${item.id}`)"
            >
              <template #icon>
                <Icon icon="lucide:eye" />
              </template>
              查阅
            </NButton>
            <NButton
              size="small"
              quaternary
              type="error"
              :disabled="item.id === 1"
              :loading="deletingId === item.id"
              @click="deleteUser(item)"
            >
              <template #icon>
                <Icon icon="lucide:trash-2" />
              </template>
              删除
            </NButton>
          </div>
        </div>
      </div>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
      <NPagination
        :page="page"
        :page-count="totalPages"
        :page-size="pageSize"
        @update:page="goToPage"
      />
    </div>

    <!-- Create User Modal -->
    <NModal v-model:show="showCreateModal" preset="card" title="创建用户" style="max-width: 420px;">
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">用户名</label>
          <NInput v-model:value="newUsername" placeholder="至少3个字符" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">密码</label>
          <NInput v-model:value="newPassword" type="password" placeholder="至少6个字符" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">角色</label>
          <NSelect v-model:value="newRole" :options="[{ label: '用户', value: 'user' }, { label: '管理员', value: 'admin' }]" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" :loading="creating" :disabled="!newUsername.trim() || newPassword.length < 6" @click="createUser">创建</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

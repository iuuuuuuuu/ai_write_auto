<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminUser {
  id: number
  username: string
  role: 'admin' | 'user'
  createdAt: string
}

const search = shallowRef('')
const deletingId = shallowRef<number | null>(null)
const { confirmDelete } = useConfirmDialog()

const queryParams = computed(() => {
  const p: Record<string, string> = {}
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
  updatePageSize,
  refresh
} = usePagination<AdminUser>({
  url: '/api/admin/users',
  params: queryParams
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
      body: {
        username: newUsername.value.trim(),
        password: newPassword.value,
        role: newRole.value
      }
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
    <section class="card-glass relative overflow-hidden p-5 md:p-6">
      <div class="liquid-orb -right-16 -top-20 h-44 w-44 bg-primary-400/20" />
      <div class="liquid-highlight" />
      <div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm text-(--ui-text-muted)">Admin / Users</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)">
            用户管理
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-(--ui-text-muted)">
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
              <Icon
                icon="lucide:search"
                class="text-(--ui-text-dimmed)"
              />
            </template>
          </NInput>
          <NButton
            type="primary"
            round
            @click="showCreateModal = true"
          >
            <template #icon><Icon icon="lucide:plus" /></template>
            创建用户
          </NButton>
        </div>
      </div>
    </section>

    <div class="card-glass overflow-hidden">
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
        class="space-y-2"
      >
        <div
          v-for="item in users"
          :key="item.id"
          class="group grid gap-3 rounded-2xl bg-white/12 px-3 py-4 ring-1 ring-white/12 transition-colors hover:bg-white/10 md:grid-cols-[1fr_130px_180px_220px] md:items-center dark:bg-white/6"
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
          <NTag :type="item.role === 'admin' ? 'info' : 'default'">
            {{ item.role === 'admin' ? '管理员' : '用户' }}
          </NTag>
          <p class="text-sm text-(--ui-text-muted)">
            {{ new Date(item.createdAt).toLocaleString() }}
          </p>
          <div class="flex flex-wrap gap-2 md:justify-end">
            <NButton
              size="small"
              secondary
              round
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
              round
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

    <div
      v-if="total > 0"
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
      <NPagination
        :page="page"
        :page-count="totalPages"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        show-size-picker
        @update:page="goToPage"
        @update:page-size="updatePageSize"
      />
    </div>

    <!-- Create User Modal -->
    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="创建用户"
      style="max-width: 420px"
    >
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">用户名</label>
          <NInput
            v-model:value="newUsername"
            placeholder="至少3个字符"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">密码</label>
          <NInput
            v-model:value="newPassword"
            type="password"
            placeholder="至少6个字符"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">角色</label>
          <NSelect
            v-model:value="newRole"
            :options="[
              { label: '用户', value: 'user' },
              { label: '管理员', value: 'admin' }
            ]"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            round
            @click="showCreateModal = false"
          >
            取消
          </NButton>
          <NButton
            type="primary"
            round
            :loading="creating"
            :disabled="!newUsername.trim() || newPassword.length < 6"
            @click="createUser"
            >创建</NButton
          >
        </div>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NTag, NButton } from 'naive-ui'
import { Icon } from '@iconify/vue'

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
const { post, del: apiDel } = useApi()

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
    await post('/api/admin/users', {
      username: newUsername.value.trim(),
      password: newPassword.value,
      role: newRole.value
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
    await apiDel(`/api/admin/users/${user.id}`)
    refresh()
  } finally {
    deletingId.value = null
  }
}

const tableColumns = [
  {
    title: '用户名',
    key: 'username',
    render(row: AdminUser) {
      return h(
        resolveComponent('NuxtLink') as any,
        { to: `/admin/users/${row.id}`, class: 'font-medium text-(--ui-text-highlighted) hover:text-primary-500' },
        () => row.username
      )
    }
  },
  {
    title: 'ID',
    key: 'id',
    width: 80
  },
  {
    title: '角色',
    key: 'role',
    width: 120,
    render(row: AdminUser) {
      return h(NTag, { type: row.role === 'admin' ? 'info' : 'default', size: 'small' }, () => row.role === 'admin' ? '管理员' : '用户')
    }
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180,
    render(row: AdminUser) {
      return new Date(row.createdAt).toLocaleString()
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    align: 'right' as const,
    render(row: AdminUser) {
      return h('div', { class: 'flex gap-2 justify-end' }, [
        h(NButton, { size: 'small', secondary: true, round: true, onClick: () => navigateTo(`/admin/users/${row.id}`) }, {
          icon: () => h(Icon, { icon: 'lucide:eye' }),
          default: () => '查阅'
        }),
        h(NButton, { size: 'small', quaternary: true, round: true, type: 'error', disabled: row.id === 1, loading: deletingId.value === row.id, onClick: () => deleteUser(row) }, {
          icon: () => h(Icon, { icon: 'lucide:trash-2' }),
          default: () => '删除'
        })
      ])
    }
  }
]
</script>

<template>
  <div class="flex flex-col gap-4 h-full overflow-hidden">
    <section class="card-glass relative overflow-hidden p-5 md:p-6 shrink-0">
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

    <div class="card-glass flex-1 min-h-0 flex flex-col overflow-hidden">
      <NDataTable
        :columns="tableColumns"
        :data="users"
        :loading="pending"
        :bordered="false"
        :single-line="false"
        flex-height
        class="flex-1"
        style="height: 0"
      />
      <div
        v-if="total > 0"
        class="flex items-center justify-between px-4 py-3 border-t border-(--ui-border)/40 shrink-0"
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

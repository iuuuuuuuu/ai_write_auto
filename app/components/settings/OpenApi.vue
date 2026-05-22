<script setup lang="ts">
interface ApiTokenItem {
  id: number
  name: string
  createdAt: string
  lastUsedAt: string | null
}

const message = useMessage()
const { data: tokens, refresh: refreshTokens } = await useFetch<ApiTokenItem[]>('/api/openapi/tokens', {
  default: () => []
})

const creating = ref(false)
const newTokenName = ref('')
const showCreateModal = ref(false)
const createdToken = ref<string | null>(null)
const deletingId = ref<number | null>(null)

function openCreateModal() {
  newTokenName.value = ''
  createdToken.value = null
  showCreateModal.value = true
}

async function createToken() {
  if (!newTokenName.value.trim()) return
  creating.value = true
  try {
    const result = await $fetch<{ id: number; name: string; token: string; createdAt: string }>(
      '/api/openapi/tokens',
      {
        method: 'POST',
        body: { name: newTokenName.value.trim() }
      }
    )
    createdToken.value = result.token
    await refreshTokens()
  } catch {
    message.error('创建 Token 失败')
  } finally {
    creating.value = false
  }
}

async function deleteToken(id: number) {
  deletingId.value = id
  try {
    await $fetch(`/api/openapi/tokens/${id}`, { method: 'DELETE' })
    await refreshTokens()
    message.success('Token 已删除')
  } catch {
    message.error('删除 Token 失败')
  } finally {
    deletingId.value = null
  }
}

function copyToken() {
  if (!createdToken.value) return
  navigator.clipboard.writeText(createdToken.value)
  message.success('Token 已复制到剪贴板')
}
</script>

<template>
  <div class="space-y-4">
    <div class="card-glass p-3 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-bold text-(--ui-text-highlighted)">
            API Token 管理
          </h3>
          <p class="mt-0.5 text-xs text-(--ui-text-dimmed)">
            创建和管理用于调用开放 API 的访问令牌。
          </p>
        </div>
        <NButton
          size="small"
          type="primary"
          @click="openCreateModal"
        >
          <template #icon>
            <Icon icon="lucide:plus" />
          </template>
          创建 Token
        </NButton>
      </div>

      <div class="rounded-2xl ring-1 ring-white/12">
        <div
          v-if="tokens.length"
          class="divide-y divide-white/15"
        >
          <div
            v-for="token in tokens"
            :key="token.id"
            class="flex items-center justify-between gap-3 px-2 py-2"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-(--ui-text)">
                {{ token.name }}
              </p>
              <p class="mt-0.5 text-[11px] text-(--ui-text-dimmed)">
                创建于 {{ new Date(token.createdAt).toLocaleString() }}
                <span v-if="token.lastUsedAt">
                  · 上次使用 {{ new Date(token.lastUsedAt).toLocaleString() }}
                </span>
              </p>
            </div>
            <NButton
              size="tiny"
              quaternary
              :loading="deletingId === token.id"
              @click="deleteToken(token.id)"
            >
              <template #icon>
                <Icon icon="lucide:trash-2" />
              </template>
            </NButton>
          </div>
        </div>
        <div
          v-else
          class="px-2 py-3 text-xs text-(--ui-text-dimmed)"
        >
          暂无 API Token，点击上方按钮创建。
        </div>
      </div>

      <div class="flex items-center gap-2">
        <NButton
          size="small"
          secondary
          tag="a"
          href="/api-docs"
          target="_blank"
        >
          <template #icon>
            <Icon icon="lucide:book-open" />
          </template>
          查看 API 文档
        </NButton>
        <NButton
          size="small"
          quaternary
          tag="a"
          href="/api/openapi/spec"
          target="_blank"
        >
          <template #icon>
            <Icon icon="lucide:file-json" />
          </template>
          下载 OpenAPI Spec
        </NButton>
      </div>
    </div>

    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="创建 API Token"
      style="max-width: 480px"
    >
      <div class="space-y-3">
        <NFormItem label="Token 名称">
          <NInput
            v-model:value="newTokenName"
            placeholder="例如：CI 部署脚本"
            @keyup.enter="createToken"
          />
        </NFormItem>

        <div
          v-if="createdToken"
          class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2"
        >
          <p class="text-xs text-amber-600">
            Token 只会显示一次，请立即复制保存。
          </p>
          <div class="flex items-center gap-2">
            <code
              class="flex-1 rounded bg-white/12 ring-1 ring-white/12 px-2 py-1 text-[11px] font-mono break-all dark:bg-white/6"
            >
              {{ createdToken }}
            </code>
            <NButton
              size="tiny"
              secondary
              @click="copyToken"
            >
              <template #icon>
                <Icon icon="lucide:copy" />
              </template>
              复制
            </NButton>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCreateModal = false">关闭</NButton>
          <NButton
            v-if="!createdToken"
            type="primary"
            :loading="creating"
            :disabled="!newTokenName.trim()"
            @click="createToken"
          >
            创建
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()

const { data: siteConfig, refresh } = await useFetch('/api/settings/site')
const saving = ref(false)

const allowRegistration = computed({
  get: () => (siteConfig.value as any)?.allow_registration === 'true',
  set: () => {}
})

async function toggleRegistration() {
  saving.value = true
  try {
    await $fetch('/api/settings/site', {
      method: 'PUT',
      body: { allow_registration: allowRegistration.value ? 'false' : 'true' }
    })
    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div>
      <p class="text-sm text-(--ui-text-muted)">Admin</p>
      <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
        {{ t('common.admin') }}
      </h1>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <section
        class="rounded-xl border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-(--ui-text-highlighted)">开放注册</p>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              允许新用户自行注册账号
            </p>
          </div>
          <UButton
            :variant="allowRegistration ? 'solid' : 'outline'"
            size="sm"
            :loading="saving"
            @click="toggleRegistration"
          >
            {{ allowRegistration ? '已开启' : '已关闭' }}
          </UButton>
        </div>
      </section>

      <section
        class="rounded-xl border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex size-10 items-center justify-center rounded-lg bg-(--ui-bg-elevated)"
          >
            <UIcon
              name="i-lucide-users"
              class="size-5 text-primary-400"
            />
          </div>
          <div>
            <p class="font-medium text-(--ui-text-highlighted)">用户管理</p>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              查看和创建平台用户
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

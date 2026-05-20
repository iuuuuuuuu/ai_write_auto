<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { data: siteConfig, refresh } =
  await useFetch<Record<string, string>>('/api/settings/site')

const saving = ref(false)
const siteName = ref('')
const siteDescription = ref('')

watch(
  siteConfig,
  (config) => {
    if (config) {
      siteName.value = config.site_name || ''
      siteDescription.value = config.site_description || ''
    }
  },
  { immediate: true }
)

async function save() {
  saving.value = true
  try {
    await $fetch('/api/settings/site', {
      method: 'PUT',
      body: {
        site_name: siteName.value,
        site_description: siteDescription.value
      }
    })
    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm text-(--ui-text-muted)">Admin / Settings</p>
      <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
        站点设置
      </h1>
      <p class="mt-1 text-sm text-(--ui-text-muted)">管理站点基本信息。</p>
    </div>

    <div class="card-surface max-w-xl space-y-4 p-6">
      <div class="flex items-center gap-3 mb-4">
        <div
          class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400/15 to-primary-600/5"
        >
          <Icon
            icon="lucide:settings"
            class="size-4.5 text-primary-500"
          />
        </div>
        <div>
          <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
            基本信息
          </h2>
          <p class="text-xs text-(--ui-text-muted)">
            站点名称和描述将显示在页面标题和 SEO 中
          </p>
        </div>
      </div>
      <div class="space-y-1.5">
        <label class="text-sm font-medium text-(--ui-text)">站点名称</label>
        <NInput
          v-model:value="siteName"
          placeholder="AI 小说写作平台"
        />
      </div>
      <div class="space-y-1.5">
        <label class="text-sm font-medium text-(--ui-text)">站点描述</label>
        <NInput
          v-model:value="siteDescription"
          type="textarea"
          :rows="3"
          placeholder="一句话描述你的站点"
        />
      </div>
      <div class="pt-2">
        <NButton
          type="primary"
          :loading="saving"
          @click="save"
        >
          保存设置
        </NButton>
      </div>
    </div>
  </div>
</template>

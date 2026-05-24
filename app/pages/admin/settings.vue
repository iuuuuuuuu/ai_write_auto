<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { data: siteConfig, refresh } =
  await useFetch<Record<string, string>>('/api/settings/site')

const { put } = useApi()

const saving = shallowRef(false)
const siteName = shallowRef('')
const siteDescription = shallowRef('')

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
    await put('/api/settings/site', {
      site_name: siteName.value,
      site_description: siteDescription.value
    })
    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div class="relative z-10">
        <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">Admin / Settings</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-[-0.05em] text-(--ui-text-highlighted)">
          站点设置
        </h1>
        <p class="mt-3 text-sm text-(--ui-text-muted)">管理站点基本信息。</p>
      </div>
    </section>

    <section class="card-glass max-w-xl space-y-5 p-6">
      <div class="flex items-center gap-3">
        <div class="liquid-panel flex size-10 items-center justify-center rounded-[1.2rem]">
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
      <div class="pt-1">
        <NButton
          type="primary"
          round
          :loading="saving"
          @click="save"
        >
          保存设置
        </NButton>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="flex items-center gap-3 mb-5">
      <div
        class="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400/15 to-primary-600/5"
      >
        <Icon
          icon="lucide:settings"
          class="size-5 text-primary-500"
        />
      </div>
      <div>
        <h1 class="text-xl font-bold text-(--ui-text-highlighted)">
          {{ t('common.settings') }}
        </h1>
        <p class="text-xs text-(--ui-text-muted)">管理个人偏好与系统配置</p>
      </div>
    </div>
    <NTabs
      type="segment"
      animated
      class="mt-4"
    >
      <NTabPane
        name="general"
        tab="通用"
      >
        <div class="mt-4">
          <SettingsGeneral />
        </div>
      </NTabPane>
      <NTabPane
        name="ai"
        tab="AI 配置"
      >
        <div class="mt-4">
          <SettingsAi />
        </div>
      </NTabPane>
      <NTabPane
        name="database"
        tab="数据库"
      >
        <div class="mt-4">
          <SettingsDatabase />
        </div>
      </NTabPane>
      <NTabPane
        name="writing"
        tab="写作目标"
      >
        <div class="mt-4">
          <SettingsWritingGoals />
        </div>
      </NTabPane>
      <NTabPane
        name="usage"
        tab="用量"
      >
        <div class="mt-4">
          <SettingsUsage />
        </div>
      </NTabPane>
      <NTabPane
        name="openapi"
        tab="Open API"
      >
        <div class="mt-4">
          <SettingsOpenApi />
        </div>
      </NTabPane>
    </NTabs>
  </div>
</template>

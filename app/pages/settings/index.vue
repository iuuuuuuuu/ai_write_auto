<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div class="relative z-10 flex items-center gap-4">
        <div
          class="liquid-panel flex size-12 items-center justify-center rounded-[1.35rem]"
        >
          <Icon
            icon="lucide:settings"
            class="size-5 text-primary-500"
          />
        </div>
        <div>
          <p
            class="mb-1 text-xs uppercase tracking-[0.22em] text-primary-500/80"
          >
            Preferences
          </p>
          <h1
            class="text-2xl font-semibold tracking-[-0.04em] text-(--ui-text-highlighted)"
          >
            {{ t('common.settings') }}
          </h1>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            管理个人偏好与系统配置
          </p>
        </div>
      </div>
    </section>

    <section class="card-glass p-3 sm:p-4">
      <NTabs
        type="line"
        placement="left"
        animated
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
          name="skills"
          tab="写作技能"
        >
          <div class="mt-4">
            <SettingsWritingSkills />
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
          name="generation-logs"
          tab="生成记录"
        >
          <div class="mt-4">
            <NuxtLink
              to="/settings/ai-generation-logs"
              class="liquid-panel flex items-center justify-between p-4 transition-colors hover:bg-(--ui-bg-muted)"
            >
              <div>
                <p class="text-sm font-medium text-(--ui-text-highlighted)">
                  查看我的生成记录
                </p>
                <p class="mt-1 text-xs text-(--ui-text-muted)">
                  包含模型、用途、token、耗时和失败原因。
                </p>
              </div>
              <Icon
                icon="lucide:arrow-right"
                class="size-4 text-(--ui-text-dimmed)"
              />
            </NuxtLink>
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
    </section>
  </div>
</template>

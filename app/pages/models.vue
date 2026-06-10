<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div class="relative z-10 flex items-center gap-4">
        <div
          class="liquid-panel flex size-12 items-center justify-center rounded-[1.35rem]"
        >
          <Icon
            icon="lucide:brain"
            class="size-5 text-primary-500"
          />
        </div>
        <div>
          <p
            class="mb-1 text-xs uppercase tracking-[0.22em] text-primary-500/80"
          >
            AI Config
          </p>
          <h1
            class="text-2xl font-semibold tracking-[-0.04em] text-(--ui-text-highlighted)"
          >
            AI 配置
          </h1>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            管理 AI 模型与用途配置
          </p>
        </div>
      </div>
    </section>

    <section class="card-glass p-3 sm:p-4">
      <SettingsAiModels />
    </section>
  </div>
</template>

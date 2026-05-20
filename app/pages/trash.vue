<script setup lang="ts">
definePageMeta({ layout: 'default' })
const { t } = useI18n()
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="flex items-center gap-3 mb-5">
      <div
        class="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-400/15 to-red-500/5"
      >
        <Icon
          icon="lucide:trash-2"
          class="size-5 text-red-500"
        />
      </div>
      <div>
        <h1 class="text-xl font-bold text-(--ui-text-highlighted)">
          {{ t('trash.title') }}
        </h1>
        <p class="text-xs text-(--ui-text-muted)">已删除的小说和章节</p>
      </div>
    </div>
    <slot />
  </div>
</template>

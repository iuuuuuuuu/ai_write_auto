<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="text-center py-12">
    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--ui-bg-muted) border border-(--ui-border) mb-4">
      <Icon :icon="icon || 'lucide:inbox'" class="w-7 h-7 text-(--ui-text-dimmed)" />
    </div>
    <h3 class="text-base font-medium text-(--ui-text-highlighted)">{{ title }}</h3>
    <p v-if="description" class="mt-1.5 text-sm text-(--ui-text-dimmed) max-w-sm mx-auto">{{ description }}</p>
    <NButton v-if="actionLabel" class="mt-4" type="primary" @click="$emit('action')">
      {{ actionLabel }}
    </NButton>
  </div>
</template>

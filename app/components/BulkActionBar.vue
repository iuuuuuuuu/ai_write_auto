<script setup lang="ts">
defineProps<{
  count: number
}>()

defineEmits<{
  clear: []
}>()
</script>

<template>
  <Transition name="slide-fade">
    <div
      v-if="count > 0"
      class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-(--ui-border) bg-(--ui-bg-elevated) px-5 py-3 shadow-xl"
    >
      <span class="text-sm text-(--ui-text-highlighted)">已选 {{ count }} 项</span>
      <slot />
      <NButton size="small" quaternary @click="$emit('clear')">
        取消选择
      </NButton>
    </div>
  </Transition>
</template>

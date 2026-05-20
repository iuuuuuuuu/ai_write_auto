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
      class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 card-glass px-4 py-2.5 shadow-2xl"
      style="border-radius: 1rem;"
    >
      <span class="text-sm font-medium text-(--ui-text-highlighted)">已选 {{ count }} 项</span>
      <slot />
      <NButton size="small" quaternary @click="$emit('clear')">
        取消选择
      </NButton>
    </div>
  </Transition>
</template>
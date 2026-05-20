<script setup lang="ts">
const containerRef = ref<HTMLElement | null>(null)

defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
}>()

defineEmits<{
  action: []
}>()

onMounted(() => {
  if (!containerRef.value) return
  containerRef.value.style.opacity = '0'
  containerRef.value.style.transform = 'scale(0.95) translateY(8px)'
  requestAnimationFrame(() => {
    if (!containerRef.value) return
    containerRef.value.style.transition = 'opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1), transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)'
    containerRef.value.style.opacity = '1'
    containerRef.value.style.transform = 'scale(1) translateY(0)'
  })
})
</script>

<template>
  <div ref="containerRef" class="text-center py-10">
    <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 relative overflow-hidden"
         style="background: linear-gradient(135deg, var(--ui-primary-300), var(--ui-primary-500)); animation: breathe 3s ease-in-out infinite;">
      <Icon :icon="icon || 'lucide:inbox'" class="w-6 h-6 text-white relative z-10" />
    </div>
    <h3 class="text-base font-semibold text-(--ui-text-highlighted)">{{ title }}</h3>
    <p v-if="description" class="mt-1 text-sm text-(--ui-text-dimmed) max-w-sm mx-auto">{{ description }}</p>
    <NButton v-if="actionLabel" class="mt-3" type="primary" @click="$emit('action')">
      {{ actionLabel }}
    </NButton>
  </div>
</template>
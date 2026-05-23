<script setup lang="ts">
import type { OnboardingStep } from '../composables/useOnboarding'

const props = defineProps<{
  steps: OnboardingStep[]
  currentStep: number
  show: boolean
}>()

const emit = defineEmits<{
  next: []
  complete: []
  skip: []
}>()

const step = computed(() => props.steps[props.currentStep] as OnboardingStep | undefined)
const isLastStep = computed(() => props.currentStep >= props.steps.length - 1)
const progressPercent = computed(
  () => ((props.currentStep + 1) / props.steps.length) * 100
)
</script>

<template>
  <NAlert
    v-if="show"
    type="info"
    :show-icon="false"
    class="mb-4"
  >
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-(--ui-text-highlighted)">
          {{ step?.title }}
        </p>
        <span class="text-[11px] text-(--ui-text-dimmed)">
          {{ currentStep + 1 }} / {{ steps.length }}
        </span>
      </div>

      <div class="h-1 w-full rounded-full bg-(--ui-bg-elevated)">
        <div
          class="h-1 rounded-full bg-primary-500 transition-all duration-300"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <p class="text-xs leading-relaxed text-(--ui-text-muted)">
        {{ step?.description }}
      </p>

      <div class="flex items-center justify-end gap-2">
        <NButton
          size="tiny"
          quaternary
          @click="emit('skip')"
        >
          跳过引导
        </NButton>
        <NButton
          size="tiny"
          type="primary"
          @click="isLastStep ? emit('complete') : emit('next')"
        >
          {{ isLastStep ? '完成' : '下一步' }}
        </NButton>
      </div>
    </div>
  </NAlert>
</template>

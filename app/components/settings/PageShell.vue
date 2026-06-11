<script setup lang="ts">
interface Props {
  eyebrow?: string
  title: string
  description: string
  icon?: string
}

withDefaults(defineProps<Props>(), {
  eyebrow: 'Settings',
  icon: 'lucide:settings'
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div
        class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-center gap-4">
          <div
            class="liquid-panel flex size-12 items-center justify-center rounded-[1.35rem]"
          >
            <Icon
              :icon="icon"
              class="size-5 text-primary-500"
            />
          </div>
          <div>
            <p
              class="mb-1 text-xs uppercase tracking-[0.22em] text-primary-500/80"
            >
              {{ eyebrow }}
            </p>
            <h1
              class="text-2xl font-semibold tracking-[-0.04em] text-(--ui-text-highlighted)"
            >
              {{ title }}
            </h1>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              {{ description }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <slot />
  </div>
</template>

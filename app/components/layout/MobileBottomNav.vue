<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { isAdmin } = useAuth()

const items = computed(() => {
  const base = [
    { label: t('dashboard.title'), icon: 'lucide:layout-dashboard', to: '/dashboard' },
    { label: '回收站', icon: 'lucide:trash-2', to: '/trash' },
    { label: t('common.settings'), icon: 'lucide:settings', to: '/settings' },
  ]
  if (isAdmin) {
    base.push({ label: t('common.admin'), icon: 'lucide:shield-check', to: '/admin' })
  }
  return base
})

function isActive(to: string) {
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 lg:hidden animate-slide-up">
    <div class="card-glass mx-3 mb-3 flex items-center justify-around rounded-full px-2 py-1.5">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="relative flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all duration-200"
        :class="[
          isActive(item.to)
            ? 'text-primary-500 scale-105'
            : 'text-(--ui-text-muted) active:scale-90 active:text-(--ui-text)'
        ]"
      >
        <Icon :icon="item.icon" class="h-5 w-5 transition-transform duration-200" :class="isActive(item.to) ? 'animate-bounce-in' : ''" />
        <span class="text-[10px] font-medium leading-tight">{{ item.label }}</span>
        <span
          v-if="isActive(item.to)"
          class="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary-500 animate-scale-pop"
        />
      </NuxtLink>
    </div>
  </nav>
</template>

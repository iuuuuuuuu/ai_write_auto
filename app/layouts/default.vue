<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, logout, isAdmin } = useAuth()

const sidebarOpen = ref(false)

const navItems = computed(() => [
  { label: t('dashboard.title'), icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: '回收站', icon: 'i-lucide-trash-2', to: '/trash' },
  { label: t('common.settings'), icon: 'i-lucide-settings', to: '/settings' },
  ...(isAdmin.value ? [{ label: t('common.admin'), icon: 'i-lucide-shield', to: '/admin' }] : []),
])
</script>

<template>
  <div class="min-h-screen bg-(--ui-bg)">
    <!-- Mobile Header -->
    <div class="lg:hidden flex items-center justify-between px-4 py-3 border-b border-(--ui-border) bg-(--ui-bg-muted) sticky top-0 z-40">
      <UButton variant="ghost" color="neutral" icon="i-lucide-menu" @click="sidebarOpen = true" />
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-pen-tool" class="w-4 h-4 text-primary-400" />
        <span class="text-sm font-medium text-white">{{ t('common.appName') }}</span>
      </div>
      <UButton variant="ghost" color="neutral" icon="i-lucide-user" size="sm" />
    </div>

    <div class="flex">
      <!-- Sidebar -->
      <aside class="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 border-r border-(--ui-border) bg-(--ui-bg-muted)">
        <div class="flex items-center gap-2.5 px-5 py-5">
          <div class="w-7 h-7 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
            <UIcon name="i-lucide-pen-tool" class="w-3.5 h-3.5 text-primary-400" />
          </div>
          <span class="text-sm font-semibold text-white">{{ t('common.appName') }}</span>
        </div>

        <nav class="flex-1 px-3 space-y-0.5 mt-2">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
            :class="route.path.startsWith(item.to)
              ? 'bg-primary-500/10 text-primary-300'
              : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)'"
          >
            <UIcon :name="item.icon" class="w-4 h-4" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="px-3 py-4 border-t border-(--ui-border)">
          <div class="flex items-center gap-2.5 px-3">
            <div class="w-7 h-7 rounded-full bg-(--ui-bg-elevated) flex items-center justify-center">
              <span class="text-xs font-medium text-(--ui-text-muted)">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-(--ui-text) truncate">{{ user?.username }}</p>
            </div>
            <UButton variant="ghost" color="neutral" icon="i-lucide-log-out" size="xs" @click="logout" />
          </div>
        </div>
      </aside>

      <!-- Main -->
      <main class="flex-1 lg:pl-60">
        <slot />
      </main>
    </div>

    <!-- Mobile Sidebar -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="sidebarOpen" class="lg:hidden fixed inset-0 z-50">
          <div class="absolute inset-0 bg-black/60" @click="sidebarOpen = false" />
          <aside class="absolute left-0 top-0 bottom-0 w-60 bg-(--ui-bg-muted) border-r border-(--ui-border)">
            <div class="flex items-center justify-between px-5 py-5">
              <div class="flex items-center gap-2.5">
                <UIcon name="i-lucide-pen-tool" class="w-4 h-4 text-primary-400" />
                <span class="text-sm font-semibold text-white">{{ t('common.appName') }}</span>
              </div>
              <UButton variant="ghost" color="neutral" icon="i-lucide-x" size="sm" @click="sidebarOpen = false" />
            </div>
            <nav class="px-3 space-y-0.5">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                :class="route.path.startsWith(item.to)
                  ? 'bg-primary-500/10 text-primary-300'
                  : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)'"
                @click="sidebarOpen = false"
              >
                <UIcon :name="item.icon" class="w-4 h-4" />
                {{ item.label }}
              </NuxtLink>
            </nav>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

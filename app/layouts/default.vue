<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, logout, isAdmin } = useAuth()

const sidebarOpen = ref(false)

const navItems = computed(() => [
  { label: t('dashboard.title'), icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: t('common.settings'), icon: 'i-lucide-settings', to: '/settings' },
  ...(isAdmin.value ? [{ label: t('common.admin'), icon: 'i-lucide-shield', to: '/admin' }] : []),
])
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Mobile Header -->
    <div class="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <UButton variant="ghost" icon="i-lucide-menu" @click="sidebarOpen = true" />
      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.appName') }}</span>
      <UButton variant="ghost" icon="i-lucide-user" size="sm" />
    </div>

    <div class="flex">
      <!-- Sidebar (Desktop) -->
      <aside class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="flex items-center gap-2 px-6 py-5">
          <UIcon name="i-lucide-book-open" class="w-6 h-6 text-primary-500" />
          <span class="font-semibold text-gray-900 dark:text-white">{{ t('common.appName') }}</span>
        </div>

        <nav class="flex-1 px-3 space-y-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
            :class="route.path.startsWith(item.to) ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'"
          >
            <UIcon :name="item.icon" class="w-5 h-5" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="px-3 py-4 border-t border-gray-200 dark:border-gray-800">
          <div class="flex items-center gap-3 px-3">
            <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <span class="text-xs font-medium text-primary-700 dark:text-primary-300">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ user?.username }}</p>
              <p class="text-xs text-gray-400">{{ user?.role }}</p>
            </div>
            <UButton variant="ghost" icon="i-lucide-log-out" size="xs" @click="logout" />
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 lg:pl-64">
        <slot />
      </main>
    </div>

    <!-- Mobile Sidebar Overlay -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="sidebarOpen" class="lg:hidden fixed inset-0 z-50">
          <div class="absolute inset-0 bg-black/50" @click="sidebarOpen = false" />
          <aside class="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 shadow-xl">
            <div class="flex items-center justify-between px-6 py-5">
              <span class="font-semibold text-gray-900 dark:text-white">{{ t('common.appName') }}</span>
              <UButton variant="ghost" icon="i-lucide-x" size="sm" @click="sidebarOpen = false" />
            </div>
            <nav class="px-3 space-y-1">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                :class="route.path.startsWith(item.to) ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'"
                @click="sidebarOpen = false"
              >
                <UIcon :name="item.icon" class="w-5 h-5" />
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

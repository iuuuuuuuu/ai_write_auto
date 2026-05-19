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
  <div class="min-h-screen bg-gray-950">
    <!-- Mobile Header -->
    <div class="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-800/60 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
      <UButton variant="ghost" color="neutral" icon="i-lucide-menu" @click="sidebarOpen = true" />
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-pen-tool" class="w-4 h-4 text-primary-400" />
        <span class="text-sm font-medium text-white">{{ t('common.appName') }}</span>
      </div>
      <UButton variant="ghost" color="neutral" icon="i-lucide-user" size="sm" />
    </div>

    <div class="flex">
      <!-- Sidebar (Desktop) -->
      <aside class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-gray-800/60 bg-gray-900/50">
        <div class="flex items-center gap-2.5 px-6 py-5">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/15">
            <UIcon name="i-lucide-pen-tool" class="w-4 h-4 text-white" />
          </div>
          <span class="font-semibold text-white">{{ t('common.appName') }}</span>
        </div>

        <nav class="flex-1 px-3 space-y-1 mt-2">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :class="route.path.startsWith(item.to)
              ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'"
          >
            <UIcon :name="item.icon" class="w-5 h-5" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="px-3 py-4 border-t border-gray-800/60">
          <div class="flex items-center gap-3 px-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-600/20 border border-primary-500/30 flex items-center justify-center">
              <span class="text-xs font-medium text-primary-300">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white truncate">{{ user?.username }}</p>
              <p class="text-xs text-gray-500">{{ user?.role }}</p>
            </div>
            <UButton variant="ghost" color="neutral" icon="i-lucide-log-out" size="xs" @click="logout" />
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
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="sidebarOpen = false" />
          <aside class="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800/60 shadow-2xl">
            <div class="flex items-center justify-between px-6 py-5">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <UIcon name="i-lucide-pen-tool" class="w-3.5 h-3.5 text-white" />
                </div>
                <span class="font-semibold text-white">{{ t('common.appName') }}</span>
              </div>
              <UButton variant="ghost" color="neutral" icon="i-lucide-x" size="sm" @click="sidebarOpen = false" />
            </div>
            <nav class="px-3 space-y-1">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
                :class="route.path.startsWith(item.to)
                  ? 'bg-primary-500/10 text-primary-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'"
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

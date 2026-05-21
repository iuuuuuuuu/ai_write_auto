<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, logout, isAdmin } = useAuth()
const { settings } = useLayoutSettings()

const sidebarOpen = ref(false)

const navItems = computed(() => [
  { label: t('dashboard.title'), icon: 'lucide:layout-dashboard', to: '/dashboard' },
  { label: '回收站', icon: 'lucide:trash-2', to: '/trash' },
  { label: t('common.settings'), icon: 'lucide:settings', to: '/settings' }
])

function isActive(to: string) {
  return route.path.startsWith(to)
}

const settingsDrawerOpen = useState('layout-settings-drawer', () => false)

useBackupNotification()
</script>

<template>
  <div>
    <!-- Desktop: Mode-based layout -->
    <div class="hidden lg:block">
      <LayoutDock
        v-if="settings.navMode === 'dock'"
        :nav-items="navItems"
        :is-active="isActive"
        :is-admin="isAdmin"
      >
        <slot />
      </LayoutDock>

      <LayoutClassic
        v-else-if="settings.navMode === 'classic'"
        :nav-items="navItems"
        :is-active="isActive"
        :is-admin="isAdmin"
      >
        <slot />
      </LayoutClassic>

      <LayoutBorderless
        v-else-if="settings.navMode === 'borderless'"
        :nav-items="navItems"
        :is-active="isActive"
        :is-admin="isAdmin"
      >
        <slot />
      </LayoutBorderless>

      <LayoutCard
        v-else-if="settings.navMode === 'card'"
        :nav-items="navItems"
        :is-active="isActive"
        :is-admin="isAdmin"
      >
        <slot />
      </LayoutCard>
    </div>

    <!-- Mobile: Always use drawer navigation -->
    <div class="lg:hidden min-h-screen bg-(--ui-bg)">
      <!-- Mobile Floating Header -->
      <div class="fixed top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-full card-glass shadow-lg">
        <button
          class="flex items-center justify-center w-7 h-7 rounded-md text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/60 transition-colors"
          @click="sidebarOpen = true"
        >
          <Icon icon="lucide:menu" class="w-4 h-4" />
        </button>
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded-md bg-primary-500/15 flex items-center justify-center">
            <Icon icon="lucide:pen-tool" class="w-3 h-3 text-primary-500" />
          </div>
          <span class="text-sm font-semibold text-(--ui-text)">{{ t('common.appName') }}</span>
        </div>
        <NotificationCenter />
        <button
          class="flex items-center justify-center w-7 h-7 rounded-md text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/60 transition-colors"
          @click="settingsDrawerOpen = true"
        >
          <Icon icon="lucide:settings" class="w-4 h-4" />
        </button>
      </div>

      <!-- Mobile Content -->
      <div class="pt-14 px-3 py-3">
        <TabBar v-if="settings.showTabs" area="user" class="mb-2" />
        <slot />
      </div>

      <!-- Mobile Drawer -->
      <Teleport to="body">
        <Transition name="overlay">
          <div v-if="sidebarOpen" class="fixed inset-0 z-50">
            <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="sidebarOpen = false" />
            <Transition name="drawer">
              <aside
                v-if="sidebarOpen"
                class="absolute left-0 top-0 bottom-0 w-[270px] flex flex-col bg-(--ui-bg-elevated)"
                style="box-shadow: 8px 0 32px -4px rgba(0, 0, 0, 0.08);"
              >
                <div class="flex items-center justify-between px-4 h-[52px]">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="w-8 h-8 rounded-[10px] flex items-center justify-center shadow-[0_2px_8px_-1px_var(--ui-glow)]"
                      style="background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600));"
                    >
                      <Icon icon="lucide:pen-tool" class="w-4 h-4 text-white" />
                    </div>
                    <span class="text-[14px] font-semibold text-(--ui-text-highlighted)">{{ t('common.appName') }}</span>
                  </div>
                  <button
                    class="flex items-center justify-center w-8 h-8 rounded-[10px] text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
                    @click="sidebarOpen = false"
                  >
                    <Icon icon="lucide:x" class="w-4 h-4" />
                  </button>
                </div>

                <nav class="flex-1 px-2.5 mt-2 space-y-1">
                  <NuxtLink
                    v-for="item in navItems"
                    :key="item.to"
                    :to="item.to"
                    class="group flex items-center h-10 gap-2.5 rounded-[10px] px-3 text-[13px] font-medium transition-all duration-200"
                    :class="[
                      isActive(item.to)
                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                        : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                    ]"
                    @click="sidebarOpen = false"
                  >
                    <Icon :icon="item.icon" class="w-[18px] h-[18px]" :class="isActive(item.to) ? 'text-primary-500' : ''" />
                    {{ item.label }}
                  </NuxtLink>

                  <template v-if="isAdmin">
                    <div class="my-2 mx-2.5 h-px bg-(--ui-border)/30" />
                    <NuxtLink
                      to="/admin"
                      class="group flex items-center h-10 gap-2.5 rounded-[10px] px-3 text-[13px] font-medium transition-all duration-200"
                      :class="[
                        isActive('/admin')
                          ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                      ]"
                      @click="sidebarOpen = false"
                    >
                      <Icon icon="lucide:shield-check" class="w-[18px] h-[18px]" />
                      {{ t('common.admin') }}
                    </NuxtLink>
                  </template>
                </nav>

                <div class="px-2.5 py-3 border-t border-(--ui-border)/20">
                  <div class="flex items-center gap-2.5 px-3 py-2">
                    <div
                      class="w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-primary-100 dark:ring-primary-800/30"
                      style="background: linear-gradient(135deg, var(--color-primary-300), var(--color-primary-500));"
                    >
                      <span class="text-xs font-bold text-white">{{ user?.username?.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[13px] font-medium text-(--ui-text) truncate">{{ user?.username }}</p>
                    </div>
                    <button
                      class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      @click="logout"
                    >
                      <Icon icon="lucide:log-out" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </aside>
            </Transition>
          </div>
        </Transition>
      </Teleport>
    </div>

    <!-- Settings Drawer (shared across all modes) -->
    <LayoutSettingsDrawer />
  </div>
</template>

<style scoped>
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
.drawer-enter-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-leave-active { transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-enter-from, .drawer-leave-to { transform: translateX(-100%); }
</style>

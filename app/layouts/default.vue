<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, logout, isAdmin } = useAuth()
const { settings } = useLayoutSettings()

const sidebarOpen = ref(false)

const navItems = computed(() => [
  {
    label: t('dashboard.title'),
    icon: 'lucide:layout-dashboard',
    to: '/dashboard'
  },
  { label: '回收站', icon: 'lucide:trash-2', to: '/trash' }
])

const settingsItem = computed(() => ({
  label: t('common.settings'),
  icon: 'lucide:settings',
  to: '/settings'
}))

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
        :settings-item="settingsItem"
        :is-active="isActive"
        :is-admin="isAdmin"
      >
        <slot />
      </LayoutDock>

      <LayoutClassic
        v-else-if="settings.navMode === 'classic'"
        :nav-items="navItems"
        :settings-item="settingsItem"
        :is-active="isActive"
        :is-admin="isAdmin"
      >
        <slot />
      </LayoutClassic>

      <LayoutBorderless
        v-else-if="settings.navMode === 'borderless'"
        :nav-items="navItems"
        :settings-item="settingsItem"
        :is-active="isActive"
        :is-admin="isAdmin"
      >
        <slot />
      </LayoutBorderless>

      <LayoutCard
        v-else-if="settings.navMode === 'card'"
        :nav-items="navItems"
        :settings-item="settingsItem"
        :is-active="isActive"
        :is-admin="isAdmin"
      >
        <slot />
      </LayoutCard>
    </div>

    <!-- Mobile: Always use drawer navigation -->
    <div class="min-h-screen lg:hidden">
      <!-- Mobile Floating Header -->
      <div
        class="fixed left-1/2 top-3 z-40 w-[calc(100%-1.5rem)] -translate-x-1/2"
      >
        <div
          class="card-glass flex h-12 items-center gap-2 rounded-full px-2.5"
        >
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-(--ui-text-muted) transition-colors hover:bg-(--ui-bg-muted) hover:text-(--ui-text)"
            @click="sidebarOpen = true"
          >
            <Icon
              icon="lucide:menu"
              class="h-4 w-4"
            />
          </button>
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500"
            >
              <Icon
                icon="lucide:pen-tool"
                class="h-3.5 w-3.5 text-white"
              />
            </div>
            <span
              class="truncate text-sm font-medium tracking-[-0.02em] text-(--ui-text-highlighted)"
              >{{ t('common.appName') }}</span
            >
          </div>
          <NotificationCenter />
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-(--ui-text-muted) transition-colors hover:bg-(--ui-bg-muted) hover:text-(--ui-text)"
            @click="settingsDrawerOpen = true"
          >
            <Icon
              icon="lucide:settings"
              class="h-4 w-4"
            />
          </button>
        </div>
      </div>

      <!-- Mobile Content -->
      <div class="px-3 pb-20 pt-20">
        <TabBar
          v-if="settings.showTabs"
          area="user"
          class="mb-3"
        />
        <slot />
      </div>

      <!-- Mobile Bottom Navigation -->
      <LayoutMobileBottomNav />

      <!-- Mobile Drawer -->
      <Teleport to="body">
        <Transition name="overlay">
          <div
            v-if="sidebarOpen"
            class="fixed inset-0 z-50"
          >
            <div
              class="absolute inset-0 bg-black/35 backdrop-blur-md"
              @click="sidebarOpen = false"
            />
            <Transition name="drawer">
              <aside
                v-if="sidebarOpen"
                class="card-glass absolute bottom-3 left-3 top-3 flex w-[min(300px,calc(100%-1.5rem))] flex-col rounded-[1.75rem]"
              >
                <div class="flex h-[60px] items-center justify-between px-4">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500"
                    >
                      <Icon
                        icon="lucide:pen-tool"
                        class="h-4 w-4 text-white"
                      />
                    </div>
                    <div>
                      <p class="text-[12px] text-(--ui-text-dimmed)">
                        AI Studio
                      </p>
                      <p
                        class="text-[14px] font-medium tracking-[-0.02em] text-(--ui-text-highlighted)"
                      >
                        {{ t('common.appName') }}
                      </p>
                    </div>
                  </div>
                  <button
                    class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-muted) transition-colors hover:bg-(--ui-bg-muted) hover:text-(--ui-text)"
                    @click="sidebarOpen = false"
                  >
                    <Icon
                      icon="lucide:x"
                      class="h-4 w-4"
                    />
                  </button>
                </div>

                <nav class="flex-1 space-y-1 px-3 pt-2">
                  <NuxtLink
                    v-for="item in navItems"
                    :key="item.to"
                    :to="item.to"
                    class="flex h-11 items-center gap-3 rounded-[1.1rem] px-3 text-[14px] font-medium transition-all duration-200"
                    :class="[
                      isActive(item.to) ?
                        'bg-primary-500/12 text-primary-600 dark:text-primary-400'
                      : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted) hover:text-(--ui-text)'
                    ]"
                    @click="sidebarOpen = false"
                  >
                    <Icon
                      :icon="item.icon"
                      class="h-[18px] w-[18px]"
                      :class="isActive(item.to) ? 'text-primary-500' : ''"
                    />
                    {{ item.label }}
                  </NuxtLink>

                  <template v-if="isAdmin">
                    <div class="mx-3 my-2 h-px bg-(--ui-border)/40" />
                    <NuxtLink
                      to="/admin"
                      class="flex h-11 items-center gap-3 rounded-[1.1rem] px-3 text-[14px] font-medium transition-all duration-200"
                      :class="[
                        isActive('/admin') ?
                          'bg-primary-500/12 text-primary-600 dark:text-primary-400'
                        : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted) hover:text-(--ui-text)'
                      ]"
                      @click="sidebarOpen = false"
                    >
                      <Icon
                        icon="lucide:shield-check"
                        class="h-[18px] w-[18px]"
                      />
                      {{ t('common.admin') }}
                    </NuxtLink>
                  </template>
                </nav>

                <div class="px-3 py-3">
                  <NuxtLink
                    :to="settingsItem.to"
                    class="mb-2 flex h-11 items-center gap-3 rounded-[1.1rem] px-3 text-[14px] font-medium transition-all duration-200"
                    :class="[
                      isActive(settingsItem.to) ?
                        'bg-primary-500/12 text-primary-600 dark:text-primary-400'
                      : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted) hover:text-(--ui-text)'
                    ]"
                    @click="sidebarOpen = false"
                  >
                    <Icon
                      :icon="settingsItem.icon"
                      class="h-[18px] w-[18px]"
                    />
                    {{ settingsItem.label }}
                  </NuxtLink>
                  <div
                    class="liquid-panel flex items-center gap-2.5 rounded-[1.25rem] px-3 py-2.5"
                  >
                    <div
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 ring-1 ring-(--ui-border)"
                    >
                      <span class="text-xs font-medium text-white">{{
                        user?.username?.charAt(0).toUpperCase()
                      }}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p
                        class="truncate text-[13px] font-medium text-(--ui-text)"
                      >
                        {{ user?.username }}
                      </p>
                    </div>
                    <button
                      class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-red-500/10 hover:text-red-500"
                      @click="logout"
                    >
                      <Icon
                        icon="lucide:log-out"
                        class="h-4 w-4"
                      />
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
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
.drawer-enter-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-leave-active {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}
</style>

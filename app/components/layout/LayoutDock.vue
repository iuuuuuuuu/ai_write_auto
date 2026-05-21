<script setup lang="ts">
const props = defineProps<{
  navItems: Array<{ label: string; icon: string; to: string }>
  isActive: (to: string) => boolean
  isAdmin: boolean
}>()

const { t } = useI18n()
const { user, logout } = useAuth()
const { settings } = useLayoutSettings()
const colorMode = useNaiveColorMode()

const settingsDrawerOpen = useState('layout-settings-drawer', () => false)

function toggleDarkMode() {
  const current = colorMode.colorModePreference.get()
  colorMode.colorModePreference.set(current === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <div class="min-h-screen bg-(--ui-bg) flex flex-col">
    <!-- Top Navigation Bar -->
    <header
      class="h-12 shrink-0 flex items-center px-4 border-b border-(--ui-border)/20 bg-(--ui-bg-elevated) z-20"
    >
      <!-- Left: Logo + App Name -->
      <div v-if="settings.showLogo" class="flex items-center gap-2.5 mr-4">
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center shadow-[0_2px_6px_-1px_var(--ui-glow)]"
          style="background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600));"
        >
          <Icon icon="lucide:pen-tool" class="w-3.5 h-3.5 text-white" />
        </div>
        <span class="text-[13px] font-semibold text-(--ui-text-highlighted) tracking-[-0.01em]">
          {{ t('common.appName') }}
        </span>
      </div>

      <!-- Nav Buttons -->
      <div v-if="settings.showNavButtons" class="flex items-center gap-1 mr-3">
        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
          @click="$router.back()"
        >
          <Icon icon="lucide:arrow-left" class="w-4 h-4" />
        </button>
        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
          @click="$router.forward()"
        >
          <Icon icon="lucide:arrow-right" class="w-4 h-4" />
        </button>
      </div>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Right: Action Buttons -->
      <div class="flex items-center gap-1">
        <NotificationCenter />
        <button
          class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
          @click="toggleDarkMode"
        >
          <Icon icon="lucide:sun" class="w-4 h-4 dark:hidden" />
          <Icon icon="lucide:moon" class="w-4 h-4 hidden dark:block" />
        </button>
        <button
          class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
          @click="settingsDrawerOpen = true"
        >
          <Icon icon="lucide:settings" class="w-4 h-4" />
        </button>
        <button
          class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          @click="logout"
        >
          <Icon icon="lucide:log-out" class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Body: Dock + Content -->
    <div class="flex flex-1 min-h-0">
      <!-- Dock Sidebar -->
      <aside class="hidden lg:flex flex-col items-center w-12 shrink-0 py-3 border-r border-(--ui-border)/20 bg-(--ui-bg-elevated)">
        <!-- Nav Icons -->
        <nav class="flex-1 flex flex-col items-center gap-1.5">
          <NTooltip
            v-for="item in navItems"
            :key="item.to"
            placement="right"
            :show-arrow="false"
          >
            <template #trigger>
              <NuxtLink
                :to="item.to"
                class="flex items-center justify-center w-9 h-9 rounded-[10px] transition-all duration-200"
                :class="[
                  isActive(item.to)
                    ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-500 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                    : 'text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                ]"
              >
                <Icon :icon="item.icon" class="w-[18px] h-[18px]" />
              </NuxtLink>
            </template>
            {{ item.label }}
          </NTooltip>

          <template v-if="isAdmin">
            <div class="w-5 h-px bg-(--ui-border)/30 my-1" />
            <NTooltip placement="right" :show-arrow="false">
              <template #trigger>
                <NuxtLink
                  to="/admin"
                  class="flex items-center justify-center w-9 h-9 rounded-[10px] transition-all duration-200"
                  :class="[
                    isActive('/admin')
                      ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-500 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                      : 'text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                  ]"
                >
                  <Icon icon="lucide:shield-check" class="w-[18px] h-[18px]" />
                </NuxtLink>
              </template>
              {{ t('common.admin') }}
            </NTooltip>
          </template>
        </nav>

        <!-- User Avatar -->
        <NTooltip placement="right" :show-arrow="false">
          <template #trigger>
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ring-2 ring-primary-100 dark:ring-primary-800/30 transition-all duration-200 hover:ring-primary-200"
              style="background: linear-gradient(135deg, var(--color-primary-300), var(--color-primary-500));"
            >
              <span class="text-xs font-bold text-white">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
          </template>
          {{ user?.username }}
        </NTooltip>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 min-w-0 flex flex-col">
        <TabBar v-if="settings.showTabs" area="user" class="shrink-0" />
        <div class="flex-1 min-h-0 overflow-auto px-4 py-3">
          <slot />
        </div>
        <footer v-if="settings.showFooter" class="shrink-0 h-8 flex items-center justify-center border-t border-(--ui-border)/20 text-[11px] text-(--ui-text-dimmed)">
          AI Novel Writing
        </footer>
      </main>
    </div>
  </div>
</template>

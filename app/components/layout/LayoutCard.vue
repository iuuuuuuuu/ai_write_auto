<script setup lang="ts">
const props = defineProps<{
  navItems: Array<{ label: string; icon: string; to: string }>
  isActive: (to: string) => boolean
  isAdmin: boolean
}>()

const { t } = useI18n()
const { user, logout } = useAuth()
const { settings, updateSetting } = useLayoutSettings()

const settingsDrawerOpen = useState('layout-settings-drawer', () => false)

function toggleSidebar() {
  updateSetting('sidebarExpanded', !settings.value.sidebarExpanded)
}
</script>

<template>
  <div class="min-h-screen bg-(--ui-bg-muted) p-3 lg:p-4">
    <div class="flex gap-3 lg:gap-4 h-[calc(100vh-24px)] lg:h-[calc(100vh-32px)]">
      <!-- Sidebar Card -->
      <aside
        class="hidden lg:flex lg:flex-col shrink-0 rounded-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] bg-(--ui-bg-elevated) shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]"
        :class="settings.sidebarExpanded ? 'w-[210px]' : 'w-[60px]'"
      >
        <!-- Logo -->
        <div
          v-if="settings.showLogo"
          class="flex items-center h-[52px] px-3 shrink-0"
          :class="settings.sidebarExpanded ? 'justify-start' : 'justify-center'"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 shadow-[0_2px_8px_-1px_var(--ui-glow)]"
              style="background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600));"
            >
              <Icon icon="lucide:pen-tool" class="w-4 h-4 text-white" />
            </div>
            <span
              class="text-[14px] font-semibold text-(--ui-text-highlighted) whitespace-nowrap tracking-[-0.01em] transition-all duration-300"
              :class="settings.sidebarExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'"
            >
              {{ t('common.appName') }}
            </span>
          </div>
        </div>

        <!-- Nav Items -->
        <nav class="flex-1 px-2 mt-2 space-y-1">
          <NTooltip
            v-for="item in navItems"
            :key="item.to"
            placement="right"
            :disabled="settings.sidebarExpanded"
            :show-arrow="false"
          >
            <template #trigger>
              <NuxtLink
                :to="item.to"
                class="group relative flex items-center h-9 rounded-[10px] px-2.5 transition-all duration-200"
                :class="[
                  isActive(item.to)
                    ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                    : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                ]"
              >
                <Icon
                  :icon="item.icon"
                  class="w-[18px] h-[18px] shrink-0 transition-all duration-200"
                  :class="[
                    !settings.sidebarExpanded && 'mx-auto',
                    isActive(item.to) ? 'text-primary-500 dark:text-primary-400' : 'group-hover:text-(--ui-text)'
                  ]"
                />
                <span
                  class="ml-2.5 text-[13px] font-medium whitespace-nowrap transition-all duration-300"
                  :class="settings.sidebarExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'"
                >
                  {{ item.label }}
                </span>
              </NuxtLink>
            </template>
            {{ item.label }}
          </NTooltip>

          <template v-if="isAdmin">
            <div class="my-2 mx-2.5 h-px bg-(--ui-border)/30" />
            <NTooltip placement="right" :disabled="settings.sidebarExpanded" :show-arrow="false">
              <template #trigger>
                <NuxtLink
                  to="/admin"
                  class="group relative flex items-center h-9 rounded-[10px] px-2.5 transition-all duration-200"
                  :class="[
                    isActive('/admin')
                      ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                  ]"
                >
                  <Icon
                    icon="lucide:shield-check"
                    class="w-[18px] h-[18px] shrink-0"
                    :class="[!settings.sidebarExpanded && 'mx-auto', isActive('/admin') ? 'text-primary-500 dark:text-primary-400' : '']"
                  />
                  <span
                    class="ml-2.5 text-[13px] font-medium whitespace-nowrap transition-all duration-300"
                    :class="settings.sidebarExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'"
                  >
                    {{ t('common.admin') }}
                  </span>
                </NuxtLink>
              </template>
              {{ t('common.admin') }}
            </NTooltip>
          </template>
        </nav>

        <!-- Collapse toggle + Settings -->
        <div class="px-2 pb-1 space-y-1">
          <button
            class="flex items-center justify-center w-full h-8 rounded-[10px] text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
            @click="toggleSidebar"
          >
            <Icon :icon="settings.sidebarExpanded ? 'lucide:panel-left-close' : 'lucide:panel-left-open'" class="w-4 h-4" :class="!settings.sidebarExpanded && 'mx-auto'" />
            <span v-if="settings.sidebarExpanded" class="ml-2 text-[12px]">{{ settings.sidebarExpanded ? '收起' : '' }}</span>
          </button>
          <button
            class="flex items-center justify-center w-full h-8 rounded-[10px] text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
            @click="settingsDrawerOpen = true"
          >
            <Icon icon="lucide:palette" class="w-4 h-4" :class="!settings.sidebarExpanded && 'mx-auto'" />
            <span v-if="settings.sidebarExpanded" class="ml-2 text-[12px]">{{ t('layoutSettings.title') }}</span>
          </button>
        </div>

        <!-- User -->
        <div class="px-2 py-3 border-t border-(--ui-border)/20">
          <div
            class="flex items-center rounded-[10px] px-2.5 py-2 hover:bg-(--ui-bg-muted)/70 cursor-pointer transition-colors"
            :class="settings.sidebarExpanded ? 'gap-2.5' : 'justify-center'"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-2 ring-primary-100 dark:ring-primary-800/30"
              style="background: linear-gradient(135deg, var(--color-primary-300), var(--color-primary-500));"
            >
              <span class="text-xs font-bold text-white">{{ user?.username?.charAt(0).toUpperCase() }}</span>
            </div>
            <template v-if="settings.sidebarExpanded">
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-medium text-(--ui-text) truncate">{{ user?.username }}</p>
              </div>
              <button
                class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                @click="logout"
              >
                <Icon icon="lucide:log-out" class="w-4 h-4" />
              </button>
            </template>
          </div>
        </div>
      </aside>

      <!-- Main Content Card -->
      <main class="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden bg-(--ui-bg-elevated) shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
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

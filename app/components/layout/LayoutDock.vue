<script setup lang="ts">
const props = defineProps<{
  navItems: Array<{ label: string; icon: string; to: string }>
  settingsItem: { label: string; icon: string; to: string } | null
  isActive: (to: string) => boolean
  isAdmin: boolean
}>()

const { t } = useI18n()
const { user, logout } = useAuth()
const { settings } = useLayoutSettings()
const colorMode = useNaiveColorMode()

const settingsDrawerOpen = useState('layout-settings-drawer', () => false)
const globalSearchOpen = useState('global-search-open', () => false)

function toggleDarkMode() {
  const current = colorMode.colorModePreference.get()
  colorMode.colorModePreference.set(current === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="sticky top-0 z-30 px-4 pt-3 pb-2"
    >
      <div class="card-glass mx-auto flex h-14 max-w-[1120px] items-center gap-3 rounded-full px-3">
        <div
          v-if="settings.showLogo"
          class="flex items-center gap-2.5 pl-1 pr-2"
        >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500"
          >
            <Icon
              icon="lucide:pen-tool"
              class="h-4 w-4 text-white"
            />
          </div>
          <div class="leading-tight">
            <p class="text-[13px] text-(--ui-text-dimmed)">AI Studio</p>
            <p
              class="text-[14px] font-medium tracking-[-0.02em] text-(--ui-text-highlighted)"
            >
              {{ t('common.appName') }}
            </p>
          </div>
        </div>

        <div
          v-if="settings.showNavButtons"
          class="flex items-center gap-1 rounded-full bg-(--ui-bg-muted) p-1"
        >
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-(--ui-bg-elevated) hover:text-(--ui-text)"
            @click="$router.back()"
          >
            <Icon
              icon="lucide:arrow-left"
              class="h-4 w-4"
            />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-(--ui-bg-elevated) hover:text-(--ui-text)"
            @click="$router.forward()"
          >
            <Icon
              icon="lucide:arrow-right"
              class="h-4 w-4"
            />
          </button>
        </div>

        <div class="flex-1" />

        <div class="flex items-center gap-1.5 pr-1">
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-(--ui-bg-muted) hover:text-(--ui-text)"
            title="Ctrl+Shift+F"
            @click="globalSearchOpen = true"
          >
            <Icon
              icon="lucide:search"
              class="h-4 w-4"
            />
          </button>
          <NotificationCenter />
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-(--ui-bg-muted) hover:text-(--ui-text)"
            @click="toggleDarkMode"
          >
            <Icon
              icon="lucide:sun"
              class="h-4 w-4 dark:hidden"
            />
            <Icon
              icon="lucide:moon"
              class="hidden h-4 w-4 dark:block"
            />
          </button>
          <NuxtLink
            v-if="settingsItem"
            :to="settingsItem.to"
            class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-(--ui-bg-muted) hover:text-(--ui-text)"
            :class="
              isActive(settingsItem.to) ?
                'bg-primary-500/12 text-primary-600 dark:text-primary-400'
              : ''
            "
          >
            <Icon
              :icon="settingsItem.icon"
              class="h-4 w-4"
            />
          </NuxtLink>
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-(--ui-bg-muted) hover:text-(--ui-text)"
            @click="settingsDrawerOpen = true"
          >
            <Icon
              icon="lucide:palette"
              class="h-4 w-4"
            />
          </button>
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-red-500/10 hover:text-red-500"
            @click="logout"
          >
            <Icon
              icon="lucide:log-out"
              class="h-4 w-4"
            />
          </button>
          <div
            :title="user?.username"
            class="ml-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary-500 ring-1 ring-(--ui-border) transition-transform hover:scale-105"
          >
            <span class="text-xs font-medium text-white">
              {{ user?.username?.charAt(0).toUpperCase() }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <aside class="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
      <nav class="liquid-dock flex items-center gap-2 rounded-[2rem] p-2">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :title="item.label"
          class="liquid-dock-item flex h-12 w-12 items-center justify-center rounded-[1.35rem]"
          :class="isActive(item.to) ? 'liquid-dock-item-active' : ''"
        >
          <Icon
            :icon="item.icon"
            class="h-5 w-5"
          />
        </NuxtLink>

        <template v-if="isAdmin">
          <div class="mx-1 h-7 w-px bg-(--ui-border)/50" />
          <NuxtLink
            to="/admin"
            :title="t('common.admin')"
            class="liquid-dock-item flex h-12 w-12 items-center justify-center rounded-[1.35rem]"
            :class="isActive('/admin') ? 'liquid-dock-item-active' : ''"
          >
            <Icon
              icon="lucide:shield-check"
              class="h-5 w-5"
            />
          </NuxtLink>
        </template>
      </nav>
    </aside>

    <div
      v-if="settings.showTabs"
      class="sticky top-[76px] z-20 bg-(--ui-bg)"
    >
      <div class="mx-auto max-w-[1440px] px-6">
        <TabBar area="user" />
      </div>
    </div>

    <main class="flex min-w-0 flex-1 flex-col px-6 pb-28 pt-4">
      <div class="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <div class="min-h-0 flex-1">
          <slot />
        </div>
        <footer
          v-if="settings.showFooter"
          class="mt-6 flex h-8 shrink-0 items-center justify-center text-[11px] text-(--ui-text-dimmed)"
        >
          AI Novel Writing
        </footer>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  navItems: Array<{ label: string; icon: string; to: string }>
  settingsItem: { label: string; icon: string; to: string }
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
  <div class="liquid-shell min-h-screen flex flex-col">
    <header
      class="fixed left-1/2 top-4 z-30 w-[min(1120px,calc(100%-2rem))] -translate-x-1/2"
    >
      <div class="card-glass flex h-14 items-center gap-3 rounded-full px-3">
        <span class="liquid-orb -left-8 -top-10 h-24 w-24" />
        <span
          class="liquid-highlight right-24 top-1 h-10 w-40 rotate-[-8deg]"
        />
        <div
          v-if="settings.showLogo"
          class="flex items-center gap-2.5 pl-1 pr-2"
        >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-full shadow-[0_8px_24px_-8px_var(--ui-glow-strong)]"
            style="
              background: linear-gradient(
                135deg,
                var(--color-primary-400),
                var(--color-primary-600)
              );
            "
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
          class="flex items-center gap-1 rounded-full bg-(--ui-bg-muted)/50 p-1"
        >
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-white/50 hover:text-(--ui-text) dark:hover:bg-white/10"
            @click="$router.back()"
          >
            <Icon
              icon="lucide:arrow-left"
              class="h-4 w-4"
            />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-white/50 hover:text-(--ui-text) dark:hover:bg-white/10"
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
          <NotificationCenter />
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-white/50 hover:text-(--ui-text) dark:hover:bg-white/10"
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
            :to="settingsItem.to"
            class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-white/50 hover:text-(--ui-text) dark:hover:bg-white/10"
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
            class="flex h-9 w-9 items-center justify-center rounded-full text-(--ui-text-dimmed) transition-colors hover:bg-white/50 hover:text-(--ui-text) dark:hover:bg-white/10"
            @click="settingsDrawerOpen = true"
          >
            <Icon
              icon="lucide:settings"
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
          <NTooltip
            placement="bottom"
            :show-arrow="false"
          >
            <template #trigger>
              <div
                class="ml-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full ring-1 ring-white/40 transition-transform hover:scale-105 dark:ring-white/10"
                style="
                  background: linear-gradient(
                    135deg,
                    var(--color-primary-300),
                    var(--color-primary-500)
                  );
                "
              >
                <span class="text-xs font-medium text-white">
                  {{ user?.username?.charAt(0).toUpperCase() }}
                </span>
              </div>
            </template>
            {{ user?.username }}
          </NTooltip>
        </div>
      </div>
    </header>

    <aside class="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
      <nav class="liquid-dock flex items-center gap-2 rounded-[2rem] p-2">
        <span class="liquid-orb -bottom-8 left-5 h-20 w-20" />
        <span class="liquid-highlight right-6 top-1 h-8 w-28 rotate-[-10deg]" />
        <NTooltip
          v-for="item in navItems"
          :key="item.to"
          placement="top"
          :show-arrow="false"
        >
          <template #trigger>
            <NuxtLink
              :to="item.to"
              class="liquid-dock-item flex h-12 w-12 items-center justify-center rounded-[1.35rem]"
              :class="isActive(item.to) ? 'liquid-dock-item-active' : ''"
            >
              <Icon
                :icon="item.icon"
                class="h-5 w-5"
              />
            </NuxtLink>
          </template>
          {{ item.label }}
        </NTooltip>

        <template v-if="isAdmin">
          <div class="mx-1 h-7 w-px bg-(--ui-border)/50" />
          <NTooltip
            placement="top"
            :show-arrow="false"
          >
            <template #trigger>
              <NuxtLink
                to="/admin"
                class="liquid-dock-item flex h-12 w-12 items-center justify-center rounded-[1.35rem]"
                :class="isActive('/admin') ? 'liquid-dock-item-active' : ''"
              >
                <Icon
                  icon="lucide:shield-check"
                  class="h-5 w-5"
                />
              </NuxtLink>
            </template>
            {{ t('common.admin') }}
          </NTooltip>
        </template>
      </nav>
    </aside>

    <main class="flex min-h-screen min-w-0 flex-1 flex-col px-6 pb-28 pt-24">
      <div class="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <TabBar
          v-if="settings.showTabs"
          area="user"
          class="mb-4 shrink-0"
        />
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

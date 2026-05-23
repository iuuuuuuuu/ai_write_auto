export interface Tab {
  id: string
  path: string
  title: string
  customTitle?: string
  closable: boolean
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
}

const STORAGE_KEYS = {
  user: 'app-tabs-user',
  admin: 'app-tabs-admin',
} as const

const DEFAULT_TABS: Record<'user' | 'admin', Tab> = {
  user: { id: 'home', path: '/dashboard', title: '仪表盘', closable: false },
  admin: { id: 'admin-home', path: '/admin', title: '管理概览', closable: false },
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function useTabs(area: 'user' | 'admin') {
  const storageKey = STORAGE_KEYS[area]
  const stateKey = `tabs-state-${area}`

  const state = useState<TabsState>(stateKey, () => ({
    tabs: [{ ...DEFAULT_TABS[area] }],
    activeTabId: DEFAULT_TABS[area].id,
  }))

  const hydrated = useState<boolean>(`tabs-hydrated-${area}`, () => false)

  const tabs = computed(() => state.value.tabs)
  const activeTab = computed(() => state.value.tabs.find(t => t.id === state.value.activeTabId) ?? null)

  function save() {
    if (!import.meta.client) return
    localStorage.setItem(storageKey, JSON.stringify(state.value))
  }

  function hydrate() {
    if (!import.meta.client || hydrated.value) return
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      try {
        const saved: TabsState = JSON.parse(raw)
        if (saved.tabs?.length) {
          state.value = saved
        }
      } catch {}
    }
    hydrated.value = true
  }

  function addTab(path: string, options?: { title?: string; closable?: boolean }) {
    hydrate()
    const existing = state.value.tabs.find(t => t.path === path)
    if (existing) {
      state.value.activeTabId = existing.id
      save()
      return existing
    }

    const tab: Tab = {
      id: generateId(),
      path,
      title: options?.title ?? path,
      closable: options?.closable ?? true,
    }

    if (state.value.tabs.length >= 30) {
      const closableTab = state.value.tabs.find(t => t.closable && t.id !== state.value.activeTabId)
      if (closableTab) {
        state.value.tabs = state.value.tabs.filter(t => t.id !== closableTab.id)
      }
    }

    state.value.tabs.push(tab)
    state.value.activeTabId = tab.id
    save()
    return tab
  }

  function removeTab(id: string) {
    const tab = state.value.tabs.find(t => t.id === id)
    if (!tab || !tab.closable) return

    const idx = state.value.tabs.indexOf(tab)
    state.value.tabs = state.value.tabs.filter(t => t.id !== id)

    if (state.value.activeTabId === id) {
      const newActive = state.value.tabs[Math.min(idx, state.value.tabs.length - 1)]
      state.value.activeTabId = newActive?.id ?? null
      if (newActive) {
        navigateTo(newActive.path)
      } else {
        navigateTo(DEFAULT_TABS[area].path)
      }
    }
    save()
  }

  const router = useRouter()

  function setActiveTab(id: string) {
    const tab = state.value.tabs.find(t => t.id === id)
    if (!tab) return
    state.value.activeTabId = id
    save()
    if (router.currentRoute.value.path !== tab.path) {
      router.push(tab.path)
    }
  }

  function renameTab(id: string, newTitle: string) {
    const tab = state.value.tabs.find(t => t.id === id)
    if (!tab) return
    tab.customTitle = newTitle || undefined
    save()
  }

  function updateTabTitle(id: string, title: string) {
    const tab = state.value.tabs.find(t => t.id === id)
    if (!tab) return
    tab.title = title
    save()
  }

  function updateActiveTabTitle(title: string) {
    if (state.value.activeTabId) {
      updateTabTitle(state.value.activeTabId, title)
    }
  }

  function closeOtherTabs(id: string) {
    state.value.tabs = state.value.tabs.filter(t => t.id === id || !t.closable)
    if (!state.value.tabs.find(t => t.id === state.value.activeTabId)) {
      state.value.activeTabId = id
      const tab = state.value.tabs.find(t => t.id === id)
      if (tab) navigateTo(tab.path)
    }
    save()
  }

  function closeTabsToRight(id: string) {
    const idx = state.value.tabs.findIndex(t => t.id === id)
    if (idx === -1) return
    state.value.tabs = state.value.tabs.filter((t, i) => i <= idx || !t.closable)
    if (!state.value.tabs.find(t => t.id === state.value.activeTabId)) {
      state.value.activeTabId = id
      const tab = state.value.tabs.find(t => t.id === id)
      if (tab) navigateTo(tab.path)
    }
    save()
  }

  function reorderTabs(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const tab = state.value.tabs[fromIndex]
    if (!tab) return
    state.value.tabs.splice(fromIndex, 1)
    state.value.tabs.splice(toIndex, 0, tab)
    save()
  }

  function activateByPath(path: string) {
    hydrate()
    const tab = state.value.tabs.find(t => t.path === path)
    if (tab) {
      state.value.activeTabId = tab.id
      save()
      return true
    }
    return false
  }

  return {
    tabs,
    activeTab,
    hydrated: computed(() => hydrated.value),
    addTab,
    removeTab,
    setActiveTab,
    renameTab,
    updateTabTitle,
    updateActiveTabTitle,
    closeOtherTabs,
    closeTabsToRight,
    reorderTabs,
    activateByPath,
    hydrate,
  }
}

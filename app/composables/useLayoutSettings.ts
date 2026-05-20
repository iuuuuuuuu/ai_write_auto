export type NavMode = 'classic' | 'borderless' | 'dock' | 'card'

export interface LayoutSettings {
  navMode: NavMode
  sidebarExpanded: boolean
  showTabs: boolean
  showBreadcrumb: boolean
  showLogo: boolean
  showFooter: boolean
  showNavButtons: boolean
  enableNavTransition: boolean
  enableRefreshTransition: boolean
}

const STORAGE_KEY = 'layout-settings'

const navModes = ['classic', 'borderless', 'dock', 'card'] as const

const defaults: LayoutSettings = {
  navMode: 'dock',
  sidebarExpanded: true,
  showTabs: true,
  showBreadcrumb: true,
  showLogo: true,
  showFooter: true,
  showNavButtons: true,
  enableNavTransition: true,
  enableRefreshTransition: true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNavMode(value: unknown): value is NavMode {
  return typeof value === 'string' && navModes.includes(value as NavMode)
}

function parseSettings(value: unknown): Partial<LayoutSettings> {
  if (!isRecord(value)) {
    return {}
  }

  const parsed: Partial<LayoutSettings> = {}

  if (isNavMode(value.navMode)) {
    parsed.navMode = value.navMode
  }

  const booleanKeys: Array<keyof Omit<LayoutSettings, 'navMode'>> = [
    'sidebarExpanded',
    'showTabs',
    'showBreadcrumb',
    'showLogo',
    'showFooter',
    'showNavButtons',
    'enableNavTransition',
    'enableRefreshTransition'
  ]

  for (const key of booleanKeys) {
    if (typeof value[key] === 'boolean') {
      parsed[key] = value[key]
    }
  }

  return parsed
}

export function useLayoutSettings() {
  const settings = useState<LayoutSettings>('layout-settings', () => ({
    ...defaults
  }))

  const initialized = useState('layout-settings-init', () => false)
  const watching = useState('layout-settings-watch', () => false)

  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) {
        return
      }

      initialized.value = true
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed: unknown = JSON.parse(saved)
          Object.assign(settings.value, {
            ...defaults,
            ...parseSettings(parsed)
          })
        }
      } catch {}
    })

    if (!watching.value) {
      watching.value = true
      watch(
        settings,
        (val) => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
        },
        { deep: true }
      )
    }
  }

  function updateSetting<K extends keyof LayoutSettings>(
    key: K,
    value: LayoutSettings[K]
  ) {
    settings.value[key] = value
  }

  function resetSettings() {
    Object.assign(settings.value, defaults)
  }

  return {
    settings,
    updateSetting,
    resetSettings
  }
}

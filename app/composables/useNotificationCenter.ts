export interface AppNotification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  link?: string
  linkLabel?: string
  createdAt: number
  read: boolean
}

const STORAGE_KEY = 'app_notifications_v1'
const MAX_NOTIFICATIONS = 50

function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed as AppNotification[]
  } catch {
    // ignore
  }
  return []
}

function saveNotifications(list: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function useNotificationCenter() {
  const notifications = useState<AppNotification[]>('app-notifications', () => loadNotifications())

  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

  function addNotification(payload: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
    const notification: AppNotification = {
      ...payload,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      read: false
    }
    const updated = [notification, ...notifications.value].slice(0, MAX_NOTIFICATIONS)
    notifications.value = updated
    saveNotifications(updated)
  }

  function markAsRead(id: string) {
    const updated = notifications.value.map(n =>
      n.id === id ? { ...n, read: true } : n
    )
    notifications.value = updated
    saveNotifications(updated)
  }

  function markAllAsRead() {
    const updated = notifications.value.map(n => ({ ...n, read: true }))
    notifications.value = updated
    saveNotifications(updated)
  }

  function removeNotification(id: string) {
    const updated = notifications.value.filter(n => n.id !== id)
    notifications.value = updated
    saveNotifications(updated)
  }

  function clearAll() {
    notifications.value = []
    saveNotifications([])
  }

  return {
    notifications: readonly(notifications),
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  }
}

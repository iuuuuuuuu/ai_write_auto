interface BackupSettings {
  lastRunAt: string | null
  lastRunSuccess: boolean | null
  lastRunError: string | null
}

interface BackupListResponse {
  backups: unknown[]
  settings: BackupSettings
}

export function useBackupNotification() {
  const message = useMessage()
  const lastNotifiedAt = useState<string | null>(
    'backup-last-notified-at',
    () => null
  )
  const { addNotification } = useNotificationCenter()

  function notifyIfNeeded(settings: BackupSettings) {
    if (settings.lastRunSuccess !== false || !settings.lastRunAt) return
    if (lastNotifiedAt.value === settings.lastRunAt) return
    lastNotifiedAt.value = settings.lastRunAt
    const errorMessage = settings.lastRunError || '未知错误'
    message.error(`定时备份失败：${errorMessage}`, {
      duration: 8000,
      closable: true
    })
    addNotification({
      type: 'error',
      title: '定时备份失败',
      message: errorMessage,
      link: '/settings/database',
      linkLabel: '查看备份设置'
    })
  }

  async function check() {
    try {
      const result = await $fetch<BackupListResponse>('/api/settings/backup')
      notifyIfNeeded(result.settings)
    } catch {
      // 静默失败，不打扰用户
    }
  }

  onMounted(() => {
    check()
    const interval = setInterval(check, 5 * 60 * 1000)
    onBeforeUnmount(() => clearInterval(interval))
  })
}

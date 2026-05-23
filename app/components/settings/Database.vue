<script setup lang="ts">
interface MigrationTablePlan {
  tableName: string
  label: string
  rows: number
  available: boolean
  error: string | null
}

interface DatabaseMigrationPlan {
  dialect: 'sqlite' | 'mysql'
  database: string
  generatedAt: string
  tables: MigrationTablePlan[]
  totalRows: number
}

interface DbConfigForm {
  type: 'sqlite' | 'mysql'
  sqlite: {
    path: string
  }
  mysql: {
    host: string
    port: number
    user: string
    password: string
    database: string
  }
}

interface MigrationTargetPreflightResult {
  success: boolean
  sameAsCurrent: boolean
  schemaSynced: boolean
  plan: DatabaseMigrationPlan | null
  error: string | null
}

interface DatabaseMigrationTableResult {
  tableName: string
  sourceRows: number
  insertedRows: number
  success: boolean
  error: string | null
}

interface DatabaseMigrationResult {
  success: boolean
  startedAt: string
  completedAt: string
  source: DatabaseMigrationPlan
  targetBefore: DatabaseMigrationPlan
  targetAfter: DatabaseMigrationPlan | null
  tables: DatabaseMigrationTableResult[]
  error: string | null
  switchedActiveDatabase: false
}

interface MigrationSwitchResult {
  success: boolean
  alreadyActive: boolean
  plan: DatabaseMigrationPlan
}

interface MigrationValidationTableResult {
  tableName: string
  label: string
  sourceRows: number
  targetRows: number
  sourceHash: string | null
  targetHash: string | null
  sourceAvailable: boolean
  targetAvailable: boolean
  rowCountMatched: boolean
  contentMatched: boolean
  matched: boolean
  error: string | null
}

interface MigrationValidationResult {
  success: boolean
  source: DatabaseMigrationPlan
  target: DatabaseMigrationPlan | null
  tables: MigrationValidationTableResult[]
  mismatches: MigrationValidationTableResult[]
  error: string | null
}

interface BackupItem {
  name: string
  type: 'sqlite' | 'mysql'
  size: number
  createdAt: string
}

interface BackupSettings {
  maxBackups: number
  autoBackupOnStartup: boolean
  scheduleEnabled: boolean
  scheduleCron: string
  lastRunAt: string | null
  lastRunSuccess: boolean | null
  lastRunError: string | null
}

interface BackupListResponse {
  backups: BackupItem[]
  settings: BackupSettings
}

interface CreateBackupResponse {
  success: boolean
  name: string
}

interface RestoreBackupResponse {
  success: boolean
  restoredFrom: string
  safetyBackup: string | null
  error?: string
  currentState?: string
}

interface UpdateBackupSettingsResponse {
  success: boolean
  settings: BackupSettings
}

const { t } = useI18n()
const message = useMessage()
const { confirm } = useConfirmDialog()

const exporting = ref(false)
const loadingBackups = ref(false)
const creatingBackup = ref(false)
const savingBackupSettings = ref(false)
const runningScheduledBackupNow = ref(false)
const restoringBackup = ref<string | null>(null)
const loadingPlan = ref(false)
const checkingTarget = ref(false)
const executingMigration = ref(false)
const switchingDatabase = ref(false)
const validatingMigration = ref(false)
const migrationPlan = ref<DatabaseMigrationPlan | null>(null)
const targetPreflight = ref<MigrationTargetPreflightResult | null>(null)
const migrationResult = ref<DatabaseMigrationResult | null>(null)
const migrationSwitchResult = ref<MigrationSwitchResult | null>(null)
const migrationValidationResult = ref<MigrationValidationResult | null>(null)
const backups = ref<BackupItem[]>([])
const lastRestoreResult = ref<
  | (RestoreBackupResponse & { preRestorePlan: DatabaseMigrationPlan | null })
  | null
>(null)
const backupSettings = reactive<BackupSettings>({
  maxBackups: 7,
  autoBackupOnStartup: false,
  scheduleEnabled: false,
  scheduleCron: '0 2 * * *',
  lastRunAt: null,
  lastRunSuccess: null,
  lastRunError: null
})
const lastNotifiedBackupFailureAt = ref<string | null>(null)
const syncTargetSchema = ref(false)
const confirmEmptyTarget = ref(false)
const confirmSwitchDatabase = ref(false)

const targetForm = reactive<DbConfigForm>({
  type: 'sqlite',
  sqlite: {
    path: './data/novel-target.db'
  },
  mysql: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'ai_novel_target'
  }
})

const unavailableTables = computed(
  () => migrationPlan.value?.tables.filter((table) => !table.available) || []
)

const planGeneratedAt = computed(() => {
  if (!migrationPlan.value?.generatedAt) return '尚未生成'
  return new Date(migrationPlan.value.generatedAt).toLocaleString('zh-CN')
})

const targetUnavailableTables = computed(
  () =>
    targetPreflight.value?.plan?.tables.filter((table) => !table.available) ||
    []
)

const targetGeneratedAt = computed(() => {
  if (!targetPreflight.value?.plan?.generatedAt) return '尚未生成'
  return new Date(targetPreflight.value.plan.generatedAt).toLocaleString(
    'zh-CN'
  )
})

const canExecuteMigration = computed(() =>
  Boolean(targetPreflight.value?.success && confirmEmptyTarget.value)
)

const canSwitchDatabase = computed(() =>
  Boolean(migrationResult.value?.success && confirmSwitchDatabase.value)
)

const validationMatchedRows = computed(
  () =>
    migrationValidationResult.value?.tables.filter((table) => table.matched)
      .length || 0
)

const migratedRows = computed(
  () =>
    migrationResult.value?.tables.reduce(
      (sum, table) => sum + table.insertedRows,
      0
    ) || 0
)

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

function formatHash(value: string | null) {
  return value ? value.slice(0, 12) : '-'
}

async function exportDatabase() {
  exporting.value = true
  try {
    const response = await fetch('/api/settings/export-db')
    if (!response.ok) {
      throw new Error('Export database failed')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `novel-db-backup-${new Date().toISOString().split('T')[0]}.db`
    a.click()
    URL.revokeObjectURL(url)
    message.success('数据库导出已开始')
  } catch {
    message.error('数据库导出失败')
  } finally {
    exporting.value = false
  }
}

function notifyBackupFailureIfNeeded(settings: BackupSettings) {
  if (settings.lastRunSuccess !== false || !settings.lastRunAt) return
  if (lastNotifiedBackupFailureAt.value === settings.lastRunAt) return
  lastNotifiedBackupFailureAt.value = settings.lastRunAt
  message.error(`定时备份失败：${settings.lastRunError || '未知错误'}`)
}

async function loadBackups(showSuccess = false) {
  loadingBackups.value = true
  try {
    const result = await $fetch<BackupListResponse>('/api/settings/backup')
    backups.value = result.backups
    Object.assign(backupSettings, result.settings)
    notifyBackupFailureIfNeeded(result.settings)
    if (showSuccess) {
      message.success('备份列表已刷新')
    }
  } catch {
    message.error('备份列表加载失败')
  } finally {
    loadingBackups.value = false
  }
}

async function saveBackupSettings() {
  savingBackupSettings.value = true
  try {
    const result = await $fetch<UpdateBackupSettingsResponse>(
      '/api/settings/backup',
      {
        method: 'PATCH',
        body: {
          maxBackups: backupSettings.maxBackups,
          autoBackupOnStartup: backupSettings.autoBackupOnStartup,
          scheduleEnabled: backupSettings.scheduleEnabled,
          scheduleCron: backupSettings.scheduleCron
        }
      }
    )
    Object.assign(backupSettings, result.settings)
    message.success('备份设置已保存')
    await loadBackups()
  } catch {
    message.error('备份设置保存失败')
  } finally {
    savingBackupSettings.value = false
  }
}

function applyBackupFrequencyPreset(cron: string) {
  backupSettings.scheduleCron = cron
}

async function runScheduledBackupNow() {
  runningScheduledBackupNow.value = true
  try {
    const result = await $fetch<CreateBackupResponse>('/api/settings/backup', {
      method: 'DELETE'
    })
    message.success(`定时备份已立即执行：${result.name}`)
    await loadBackups()
  } catch {
    message.error('立即执行定时备份失败')
  } finally {
    runningScheduledBackupNow.value = false
  }
}

async function createBackup() {
  creatingBackup.value = true
  try {
    const result = await $fetch<CreateBackupResponse>('/api/settings/backup', {
      method: 'POST'
    })
    message.success(`备份已创建：${result.name}`)
    await loadBackups()
  } catch {
    message.error('创建备份失败，请检查当前数据库连接和权限')
  } finally {
    creatingBackup.value = false
  }
}

async function restoreBackup(backup: BackupItem) {
  const confirmed = await confirm({
    title: '恢复数据库备份',
    content: `确定恢复「${backup.name}」吗？恢复前会自动创建当前数据库的安全备份。`,
    type: 'warning',
    positiveText: '恢复'
  })

  if (!confirmed) return

  restoringBackup.value = backup.name
  lastRestoreResult.value = null
  const preRestorePlan = migrationPlan.value

  try {
    const result = await $fetch<RestoreBackupResponse>('/api/settings/backup', {
      method: 'PUT',
      body: { name: backup.name }
    })

    if (!result.success) {
      lastRestoreResult.value = {
        ...result,
        preRestorePlan
      }
      message.error(
        `恢复失败：${result.error || '未知错误'}（当前数据库类型：${result.currentState || 'unknown'}）`
      )
      return
    }

    lastRestoreResult.value = {
      ...result,
      preRestorePlan
    }

    const safetyInfo =
      result.safetyBackup ?
        `，安全备份：${result.safetyBackup}`
      : '（安全备份未生成，请检查磁盘空间）'
    message.success(`已恢复备份${safetyInfo}`)
    await loadBackups()
    await loadMigrationPlan()
  } catch (e: any) {
    lastRestoreResult.value = {
      success: false,
      restoredFrom: backup.name,
      safetyBackup: null,
      error: e?.data?.message || e?.message || '网络或服务器错误',
      currentState: 'unknown',
      preRestorePlan
    }
    message.error(
      `恢复备份失败：${e?.data?.message || e?.message || '网络或服务器错误'}`
    )
  } finally {
    restoringBackup.value = null
  }
}

async function loadMigrationPlan() {
  loadingPlan.value = true
  try {
    migrationPlan.value = await $fetch<DatabaseMigrationPlan>(
      '/api/settings/migration-plan'
    )
    message.success('迁移预检已生成')
  } catch {
    message.error('迁移预检失败')
  } finally {
    loadingPlan.value = false
  }
}

function buildTargetPayload() {
  if (targetForm.type === 'sqlite') {
    return {
      type: 'sqlite' as const,
      sqlite: {
        path: targetForm.sqlite.path.trim()
      }
    }
  }

  return {
    type: 'mysql' as const,
    mysql: {
      host: targetForm.mysql.host.trim(),
      port: Number(targetForm.mysql.port),
      user: targetForm.mysql.user.trim(),
      password: targetForm.mysql.password,
      database: targetForm.mysql.database.trim()
    }
  }
}

async function runTargetPreflight() {
  if (targetForm.type === 'sqlite' && !targetForm.sqlite.path.trim()) {
    message.error('请输入目标 SQLite 路径')
    return
  }

  if (
    targetForm.type === 'mysql' &&
    (!targetForm.mysql.host.trim() ||
      !targetForm.mysql.user.trim() ||
      !targetForm.mysql.database.trim())
  ) {
    message.error('请填写目标 MySQL 连接信息')
    return
  }

  checkingTarget.value = true
  migrationResult.value = null
  migrationSwitchResult.value = null
  migrationValidationResult.value = null
  try {
    targetPreflight.value = await $fetch<MigrationTargetPreflightResult>(
      '/api/settings/migration-target',
      {
        method: 'POST',
        body: {
          target: buildTargetPayload(),
          syncSchema: syncTargetSchema.value
        }
      }
    )

    if (targetPreflight.value.success) {
      message.success('目标库预检已完成')
    } else {
      message.error(targetPreflight.value.error || '目标库预检失败')
    }
  } catch {
    message.error('目标库预检失败')
  } finally {
    checkingTarget.value = false
  }
}

async function executeMigration() {
  if (!targetPreflight.value?.success) {
    message.error('请先完成目标库预检')
    return
  }
  if (!confirmEmptyTarget.value) {
    message.error('请确认目标库为空')
    return
  }

  executingMigration.value = true
  try {
    migrationResult.value = await $fetch<DatabaseMigrationResult>(
      '/api/settings/migration-execute',
      {
        method: 'POST',
        body: {
          target: buildTargetPayload(),
          confirmEmptyTarget: true
        }
      }
    )

    if (migrationResult.value.success) {
      message.success('数据迁移已完成')
      confirmSwitchDatabase.value = false
      migrationValidationResult.value = null
      await loadMigrationPlan()
      await runTargetPreflight()
    } else {
      message.error(migrationResult.value.error || '数据迁移失败')
    }
  } catch {
    message.error('数据迁移失败')
  } finally {
    executingMigration.value = false
  }
}

async function validateMigration() {
  if (!migrationResult.value?.success) {
    message.error('请先完成数据迁移')
    return
  }

  validatingMigration.value = true
  try {
    migrationValidationResult.value = await $fetch<MigrationValidationResult>(
      '/api/settings/migration-validate',
      {
        method: 'POST',
        body: {
          target: buildTargetPayload()
        }
      }
    )

    if (migrationValidationResult.value.success) {
      message.success('迁移校验通过')
    } else {
      message.error(migrationValidationResult.value.error || '迁移校验未通过')
    }
  } catch {
    message.error('迁移校验失败')
  } finally {
    validatingMigration.value = false
  }
}

async function switchDatabase() {
  if (!migrationResult.value?.success) {
    message.error('请先完成数据迁移')
    return
  }
  if (!confirmSwitchDatabase.value) {
    message.error('请确认切换当前数据库')
    return
  }

  switchingDatabase.value = true
  try {
    migrationSwitchResult.value = await $fetch<MigrationSwitchResult>(
      '/api/settings/migration-switch',
      {
        method: 'POST',
        body: {
          target: buildTargetPayload(),
          confirmSwitch: true
        }
      }
    )

    if (migrationSwitchResult.value.success) {
      message.success(
        migrationSwitchResult.value.alreadyActive ?
          '当前已使用目标数据库'
        : '已切换到目标数据库'
      )
      await loadMigrationPlan()
      await runTargetPreflight()
    }
  } catch {
    message.error('切换数据库失败')
  } finally {
    switchingDatabase.value = false
  }
}
onMounted(() => {
  loadBackups()
})
</script>

<template>
  <div class="space-y-4">
    <div class="card-glass p-3 space-y-3">
      <h3 class="text-sm font-bold text-(--ui-text-highlighted)">
        {{ t('settings.database') }}
      </h3>

      <div class="flex flex-wrap gap-2">
        <NButton
          secondary
          :loading="exporting"
          @click="exportDatabase"
        >
          <template #icon>
            <Icon icon="lucide:download" />
          </template>
          {{ t('settings.exportDb') }}
        </NButton>
        <NButton
          secondary
          :loading="creatingBackup"
          @click="createBackup"
        >
          <template #icon>
            <Icon icon="lucide:archive" />
          </template>
          创建备份
        </NButton>
        <NButton
          quaternary
          :loading="loadingBackups"
          @click="loadBackups(true)"
        >
          <template #icon>
            <Icon icon="lucide:refresh-cw" />
          </template>
          刷新备份
        </NButton>
      </div>

      <div
        class="grid gap-3 rounded-2xl ring-1 ring-(--ui-border) p-2"
        :class="
          backupSettings.scheduleEnabled ?
            'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'
          : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
        "
      >
        <label class="space-y-1 text-xs text-(--ui-text-muted)">
          <span>保留备份数</span>
          <NInputNumber
            v-model:value="backupSettings.maxBackups"
            size="small"
            class="w-full"
            :min="1"
            :max="30"
          />
        </label>
        <label class="space-y-1 text-xs text-(--ui-text-muted)">
          <span>启动时自动备份</span>
          <div class="flex h-8 items-center">
            <NSwitch v-model:value="backupSettings.autoBackupOnStartup" />
          </div>
        </label>
        <label
          v-if="backupSettings.scheduleEnabled"
          class="space-y-1 text-xs text-(--ui-text-muted)"
        >
          <span>Cron 表达式</span>
          <NInput
            v-model:value="backupSettings.scheduleCron"
            size="small"
            placeholder="0 2 * * *"
          />
        </label>
        <div class="flex items-end gap-2">
          <NButton
            size="small"
            secondary
            :loading="savingBackupSettings"
            @click="saveBackupSettings"
          >
            <template #icon>
              <Icon icon="lucide:save" />
            </template>
            保存设置
          </NButton>
        </div>
        <div
          v-if="backupSettings.scheduleEnabled"
          class="sm:col-span-full flex flex-wrap items-center gap-2 border-t border-(--ui-border) pt-2"
        >
          <span class="text-xs text-(--ui-text-dimmed)">频率预设：</span>
          <NButton size="tiny" quaternary @click="applyBackupFrequencyPreset('0 2 * * *')">每天 02:00</NButton>
          <NButton size="tiny" quaternary @click="applyBackupFrequencyPreset('0 2 * * 1')">每周一 02:00</NButton>
          <NButton size="tiny" quaternary @click="applyBackupFrequencyPreset('0 */6 * * *')">每 6 小时</NButton>
          <NButton
            size="tiny"
            secondary
            :loading="runningScheduledBackupNow"
            @click="runScheduledBackupNow"
          >
            <template #icon><Icon icon="lucide:play" /></template>
            立即执行
          </NButton>
        </div>
      </div>

      <!-- Scheduled backup toggle and status -->
      <div
        class="flex items-center justify-between rounded-2xl ring-1 ring-(--ui-border) px-3 py-2"
      >
        <div class="flex items-center gap-3">
          <NSwitch v-model:value="backupSettings.scheduleEnabled" />
          <div class="text-xs">
            <p class="text-(--ui-text-muted)">定时自动备份</p>
            <p
              v-if="backupSettings.scheduleEnabled"
              class="text-(--ui-text-dimmed)"
            >
              下次运行按 {{ backupSettings.scheduleCron }} 执行
            </p>
          </div>
        </div>
        <div
          v-if="backupSettings.lastRunAt"
          class="text-right text-[11px]"
        >
          <p
            :class="
              backupSettings.lastRunSuccess ? 'text-emerald-500' : (
                'text-rose-500'
              )
            "
          >
            上次运行：{{ new Date(backupSettings.lastRunAt).toLocaleString() }}
            {{ backupSettings.lastRunSuccess ? '成功' : '失败' }}
          </p>
          <p
            v-if="!backupSettings.lastRunSuccess && backupSettings.lastRunError"
            class="text-rose-400"
          >
            {{ backupSettings.lastRunError }}
          </p>
        </div>
      </div>

      <NAlert
        v-if="backupSettings.lastRunSuccess === false"
        type="error"
        title="定时备份失败"
        closable
      >
        <p class="text-xs">
          上次定时备份运行失败：{{ backupSettings.lastRunError || '未知错误' }}。请检查数据库连接、磁盘空间及备份目录权限。
        </p>
      </NAlert>

      <div class="rounded-2xl ring-1 ring-(--ui-border)">
        <div
          class="flex items-center justify-between gap-2 border-b border-(--ui-border) px-2 py-1.5"
        >
          <span class="text-xs text-(--ui-text-dimmed)">数据库备份</span>
          <span class="text-[11px] text-(--ui-text-dimmed)">
            {{ backups.length ? `${backups.length} 个` : '尚未加载' }}
          </span>
        </div>
        <div
          v-if="backups.length"
          class="divide-y divide-(--ui-border)"
        >
          <div
            v-for="backup in backups"
            :key="backup.name"
            class="flex items-center justify-between gap-3 px-2 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-xs font-mono text-(--ui-text)">
                {{ backup.name }}
              </p>
              <p class="mt-0.5 text-[11px] text-(--ui-text-dimmed)">
                {{ backup.type === 'mysql' ? 'MySQL' : 'SQLite' }} ·
                {{ formatBytes(backup.size) }} ·
                {{ formatDate(backup.createdAt) }}
              </p>
            </div>
            <NButton
              size="tiny"
              type="warning"
              secondary
              :loading="restoringBackup === backup.name"
              @click="restoreBackup(backup)"
            >
              <template #icon>
                <Icon icon="lucide:rotate-ccw" />
              </template>
              恢复
            </NButton>
          </div>
        </div>
        <div
          v-else
          class="px-2 py-3 text-xs text-(--ui-text-dimmed)"
        >
          点击刷新备份查看本地数据库备份。
        </div>
      </div>

      <!-- Restore Result -->
      <div
        v-if="lastRestoreResult"
        class="rounded-md border p-2"
        :class="
          lastRestoreResult.success ?
            'border-emerald-500/30 bg-emerald-500/5'
          : 'border-rose-500/30 bg-rose-500/5'
        "
      >
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="font-medium text-(--ui-text-highlighted)">
            {{ lastRestoreResult.success ? '恢复成功' : '恢复失败' }}
          </span>
          <span
            :class="
              lastRestoreResult.success ? 'text-emerald-600' : 'text-rose-600'
            "
          >
            {{ lastRestoreResult.restoredFrom }}
          </span>
        </div>
        <p
          v-if="!lastRestoreResult.success && lastRestoreResult.error"
          class="mt-1 text-xs text-rose-600"
        >
          {{ lastRestoreResult.error }}
        </p>
        <div class="mt-2 grid gap-2 sm:grid-cols-3">
          <div class="rounded-2xl ring-1 ring-(--ui-border) p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">当前数据库</p>
            <p class="mt-1 text-xs font-mono text-(--ui-text)">
              {{ lastRestoreResult.currentState || 'unknown' }}
            </p>
          </div>
          <div class="rounded-2xl ring-1 ring-(--ui-border) p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">安全备份</p>
            <p class="mt-1 text-xs font-mono text-(--ui-text)">
              {{ lastRestoreResult.safetyBackup || '未生成' }}
            </p>
          </div>
          <div class="rounded-2xl ring-1 ring-(--ui-border) p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">恢复前总行数</p>
            <p class="mt-1 text-xs font-mono text-(--ui-text)">
              {{ formatNumber(lastRestoreResult.preRestorePlan?.totalRows || 0) }}
            </p>
          </div>
        </div>
        <div
          v-if="lastRestoreResult.preRestorePlan && migrationPlan"
          class="mt-2 overflow-hidden rounded-2xl ring-1 ring-(--ui-border)"
        >
          <div class="flex items-center gap-2 px-2 py-1.5 bg-(--ui-bg-muted)">
            <span class="text-[11px] text-(--ui-text-dimmed)">恢复前后对比</span>
            <span
              v-if="!lastRestoreResult.success"
              class="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600"
            >
              失败
            </span>
          </div>
          <table class="w-full text-xs">
            <thead class="bg-(--ui-bg-muted)">
              <tr>
                <th class="px-2 py-1.5 text-left text-(--ui-text-dimmed)">表</th>
                <th class="px-2 py-1.5 text-right text-(--ui-text-dimmed)">
                  恢复前
                </th>
                <th class="px-2 py-1.5 text-right text-(--ui-text-dimmed)">
                  恢复后
                </th>
                <th class="px-2 py-1.5 text-right text-(--ui-text-dimmed)">
                  差异
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-(--ui-border)">
              <tr
                v-for="table in migrationPlan.tables"
                :key="table.tableName"
              >
                <td class="px-2 py-1.5">
                  <p class="text-(--ui-text)">{{ table.label }}</p>
                </td>
                <td class="px-2 py-1.5 text-right font-mono text-(--ui-text-dimmed)">
                  {{
                    formatNumber(
                      lastRestoreResult.preRestorePlan.tables.find(
                        (t) => t.tableName === table.tableName
                      )?.rows || 0
                    )
                  }}
                </td>
                <td class="px-2 py-1.5 text-right font-mono text-(--ui-text)">
                  {{ formatNumber(table.rows) }}
                </td>
                <td class="px-2 py-1.5 text-right font-mono">
                  <span
                    :class="
                      table.rows -
                        (lastRestoreResult.preRestorePlan.tables.find(
                          (t) => t.tableName === table.tableName
                        )?.rows || 0) >
                      0
                        ? 'text-emerald-600'
                        : table.rows -
                            (lastRestoreResult.preRestorePlan.tables.find(
                              (t) => t.tableName === table.tableName
                            )?.rows || 0) <
                            0
                          ? 'text-rose-600'
                          : 'text-(--ui-text-dimmed)'
                    "
                  >
                    {{
                      (() => {
                        const before =
                          lastRestoreResult.preRestorePlan.tables.find(
                            (t) => t.tableName === table.tableName
                          )?.rows || 0
                        const diff = table.rows - before
                        return diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)
                      })()
                    }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card-surface p-3 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-bold text-(--ui-text-highlighted)">
            数据迁移预检
          </h3>
          <p class="mt-0.5 text-xs text-(--ui-text-dimmed)">
            只读取当前数据库表清单和行数，不会复制、删除或修改数据。
          </p>
        </div>
        <NButton
          size="small"
          secondary
          :loading="loadingPlan"
          @click="loadMigrationPlan"
        >
          <template #icon>
            <Icon icon="lucide:list-checks" />
          </template>
          生成预检
        </NButton>
      </div>

      <div
        v-if="migrationPlan"
        class="space-y-3"
      >
        <div class="grid gap-2 sm:grid-cols-3">
          <div class="rounded-md border border-(--ui-border)/50 p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">数据库</p>
            <p class="mt-1 truncate text-xs font-mono text-(--ui-text)">
              {{ migrationPlan.database }}
            </p>
          </div>
          <div class="rounded-md border border-(--ui-border)/50 p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">类型</p>
            <p class="mt-1 text-xs font-mono uppercase text-(--ui-text)">
              {{ migrationPlan.dialect }}
            </p>
          </div>
          <div class="rounded-md border border-(--ui-border)/50 p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">总行数</p>
            <p class="mt-1 text-xs font-mono text-(--ui-text)">
              {{ formatNumber(migrationPlan.totalRows) }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-(--ui-text-dimmed)"
            >生成时间：{{ planGeneratedAt }}</span
          >
          <span
            :class="
              unavailableTables.length ? 'text-amber-600' : 'text-emerald-600'
            "
          >
            {{
              unavailableTables.length ?
                `${unavailableTables.length} 张表不可用`
              : '所有表可访问'
            }}
          </span>
        </div>

        <div class="overflow-hidden rounded-md border border-(--ui-border)/50">
          <table class="w-full text-xs">
            <thead class="bg-(--ui-bg-muted)/50">
              <tr>
                <th class="px-2 py-1.5 text-left text-(--ui-text-dimmed)">
                  表
                </th>
                <th class="px-2 py-1.5 text-right text-(--ui-text-dimmed)">
                  行数
                </th>
                <th class="px-2 py-1.5 text-right text-(--ui-text-dimmed)">
                  状态
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-(--ui-border)/40">
              <tr
                v-for="table in migrationPlan.tables"
                :key="table.tableName"
              >
                <td class="px-2 py-1.5">
                  <p class="text-(--ui-text)">{{ table.label }}</p>
                  <p class="font-mono text-[10px] text-(--ui-text-dimmed)">
                    {{ table.tableName }}
                  </p>
                  <p
                    v-if="table.error"
                    class="mt-1 text-[10px] text-rose-600"
                  >
                    {{ table.error }}
                  </p>
                </td>
                <td class="px-2 py-1.5 text-right font-mono text-(--ui-text)">
                  {{ formatNumber(table.rows) }}
                </td>
                <td class="px-2 py-1.5 text-right">
                  <span
                    :class="
                      table.available ? 'text-emerald-600' : 'text-rose-600'
                    "
                  >
                    {{ table.available ? '可访问' : '异常' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card-surface p-3 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-bold text-(--ui-text-highlighted)">
            目标库预检
          </h3>
          <p class="mt-0.5 text-xs text-(--ui-text-dimmed)">
            测试迁移目标库连接，并检查目标库表状态。
          </p>
        </div>
        <NButton
          size="small"
          type="primary"
          :loading="checkingTarget"
          @click="runTargetPreflight"
        >
          <template #icon>
            <Icon icon="lucide:database-zap" />
          </template>
          预检目标库
        </NButton>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2"
      >
        <label class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
          <NCheckbox v-model:checked="confirmEmptyTarget" />
          <span>我确认目标库没有需要保留的业务数据</span>
        </label>
        <NButton
          size="small"
          type="warning"
          :disabled="!canExecuteMigration"
          :loading="executingMigration"
          @click="executeMigration"
        >
          <template #icon>
            <Icon icon="lucide:arrow-right-left" />
          </template>
          执行迁移
        </NButton>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <div class="space-y-2">
          <div class="grid gap-2 sm:grid-cols-2">
            <label class="space-y-1 text-xs text-(--ui-text-muted)">
              <span>目标类型</span>
              <NSelect
                v-model:value="targetForm.type"
                size="small"
                :options="[
                  { label: 'SQLite', value: 'sqlite' },
                  { label: 'MySQL', value: 'mysql' }
                ]"
              />
            </label>
            <label class="space-y-1 text-xs text-(--ui-text-muted)">
              <span>安全同步 schema</span>
              <div class="flex h-8 items-center">
                <NSwitch v-model:value="syncTargetSchema" />
              </div>
            </label>
          </div>

          <label
            v-if="targetForm.type === 'sqlite'"
            class="space-y-1 text-xs text-(--ui-text-muted)"
          >
            <span>SQLite 路径</span>
            <NInput
              v-model:value="targetForm.sqlite.path"
              size="small"
              placeholder="./data/novel-target.db"
            />
          </label>

          <div
            v-else
            class="grid gap-2 sm:grid-cols-2"
          >
            <label class="space-y-1 text-xs text-(--ui-text-muted)">
              <span>Host</span>
              <NInput
                v-model:value="targetForm.mysql.host"
                size="small"
              />
            </label>
            <label class="space-y-1 text-xs text-(--ui-text-muted)">
              <span>Port</span>
              <NInputNumber
                v-model:value="targetForm.mysql.port"
                size="small"
                class="w-full"
                :min="1"
                :max="65535"
              />
            </label>
            <label class="space-y-1 text-xs text-(--ui-text-muted)">
              <span>User</span>
              <NInput
                v-model:value="targetForm.mysql.user"
                size="small"
              />
            </label>
            <label class="space-y-1 text-xs text-(--ui-text-muted)">
              <span>Password</span>
              <NInput
                v-model:value="targetForm.mysql.password"
                size="small"
                type="password"
                show-password-on="click"
              />
            </label>
            <label
              class="space-y-1 text-xs text-(--ui-text-muted) sm:col-span-2"
            >
              <span>Database</span>
              <NInput
                v-model:value="targetForm.mysql.database"
                size="small"
              />
            </label>
          </div>
        </div>

        <div
          v-if="targetPreflight"
          class="space-y-2 rounded-md border border-(--ui-border)/50 p-2"
        >
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="text-(--ui-text-dimmed)">目标状态</span>
            <span
              :class="
                targetPreflight.success ? 'text-emerald-600' : 'text-rose-600'
              "
            >
              {{ targetPreflight.success ? '通过' : '失败' }}
            </span>
          </div>
          <p
            v-if="targetPreflight.error"
            class="text-xs text-rose-600"
          >
            {{ targetPreflight.error }}
          </p>
          <p
            v-if="targetPreflight.sameAsCurrent"
            class="text-xs text-amber-600"
          >
            目标库与当前库相同，请更换目标配置。
          </p>
          <template v-if="targetPreflight.plan">
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-(--ui-border)/40 p-2">
                <p class="text-[11px] text-(--ui-text-dimmed)">目标库</p>
                <p class="mt-1 truncate text-xs font-mono text-(--ui-text)">
                  {{ targetPreflight.plan.database }}
                </p>
              </div>
              <div class="rounded border border-(--ui-border)/40 p-2">
                <p class="text-[11px] text-(--ui-text-dimmed)">目标行数</p>
                <p class="mt-1 text-xs font-mono text-(--ui-text)">
                  {{ formatNumber(targetPreflight.plan.totalRows) }}
                </p>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="text-(--ui-text-dimmed)"
                >生成时间：{{ targetGeneratedAt }}</span
              >
              <span
                :class="
                  targetUnavailableTables.length ? 'text-amber-600' : (
                    'text-emerald-600'
                  )
                "
              >
                {{
                  targetUnavailableTables.length ?
                    `${targetUnavailableTables.length} 张表不可用`
                  : '所有表可访问'
                }}
              </span>
            </div>
          </template>
        </div>
      </div>

      <div
        v-if="migrationResult"
        class="space-y-2 rounded-md border border-(--ui-border)/50 p-2"
      >
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-(--ui-text-dimmed)">迁移结果</span>
          <span
            :class="
              migrationResult.success ? 'text-emerald-600' : 'text-rose-600'
            "
          >
            {{ migrationResult.success ? '完成' : '失败' }}
          </span>
        </div>
        <p
          v-if="migrationResult.error"
          class="text-xs text-rose-600"
        >
          {{ migrationResult.error }}
        </p>
        <div class="grid gap-2 sm:grid-cols-3">
          <div class="rounded border border-(--ui-border)/40 p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">迁移表数</p>
            <p class="mt-1 text-xs font-mono text-(--ui-text)">
              {{ migrationResult.tables.length }}
            </p>
          </div>
          <div class="rounded border border-(--ui-border)/40 p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">写入行数</p>
            <p class="mt-1 text-xs font-mono text-(--ui-text)">
              {{ formatNumber(migratedRows) }}
            </p>
          </div>
          <div class="rounded border border-(--ui-border)/40 p-2">
            <p class="text-[11px] text-(--ui-text-dimmed)">已切换当前库</p>
            <p class="mt-1 text-xs font-mono text-(--ui-text)">
              {{ migrationResult.switchedActiveDatabase ? '是' : '否' }}
            </p>
          </div>
        </div>
        <p class="text-[11px] text-(--ui-text-dimmed)">
          迁移完成后不会自动切换当前数据库配置，请确认目标库数据后再手动切换。
        </p>
        <div
          v-if="migrationResult.success"
          class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--ui-border)/50 p-2"
        >
          <div>
            <p class="text-xs text-(--ui-text)">迁移校验</p>
            <p class="mt-0.5 text-[11px] text-(--ui-text-dimmed)">
              对比当前库与目标库所有迁移表行数。
            </p>
          </div>
          <NButton
            size="small"
            secondary
            :loading="validatingMigration"
            @click="validateMigration"
          >
            <template #icon>
              <Icon icon="lucide:shield-check" />
            </template>
            校验目标库
          </NButton>
        </div>
        <div
          v-if="migrationValidationResult"
          class="space-y-2 rounded-md border border-(--ui-border)/50 p-2"
        >
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="text-(--ui-text-dimmed)">校验结果</span>
            <span
              :class="
                migrationValidationResult.success ? 'text-emerald-600' : (
                  'text-rose-600'
                )
              "
            >
              {{ migrationValidationResult.success ? '通过' : '异常' }}
            </span>
          </div>
          <div class="grid gap-2 sm:grid-cols-3">
            <div class="rounded border border-(--ui-border)/40 p-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">匹配表数</p>
              <p class="mt-1 text-xs font-mono text-(--ui-text)">
                {{ validationMatchedRows }} /
                {{ migrationValidationResult.tables.length }}
              </p>
            </div>
            <div class="rounded border border-(--ui-border)/40 p-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">异常表数</p>
              <p class="mt-1 text-xs font-mono text-(--ui-text)">
                {{ migrationValidationResult.mismatches.length }}
              </p>
            </div>
            <div class="rounded border border-(--ui-border)/40 p-2">
              <p class="text-[11px] text-(--ui-text-dimmed)">目标行数</p>
              <p class="mt-1 text-xs font-mono text-(--ui-text)">
                {{
                  formatNumber(migrationValidationResult.target?.totalRows || 0)
                }}
              </p>
            </div>
          </div>
          <div
            v-if="migrationValidationResult.mismatches.length"
            class="overflow-hidden rounded border border-rose-500/30"
          >
            <table class="w-full text-xs">
              <thead class="bg-rose-500/5">
                <tr>
                  <th class="px-2 py-1.5 text-left text-(--ui-text-dimmed)">
                    表
                  </th>
                  <th class="px-2 py-1.5 text-right text-(--ui-text-dimmed)">
                    当前库
                  </th>
                  <th class="px-2 py-1.5 text-right text-(--ui-text-dimmed)">
                    目标库
                  </th>
                  <th class="px-2 py-1.5 text-right text-(--ui-text-dimmed)">
                    指纹
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-rose-500/20">
                <tr
                  v-for="table in migrationValidationResult.mismatches"
                  :key="table.tableName"
                >
                  <td class="px-2 py-1.5">
                    <p class="text-(--ui-text)">{{ table.label }}</p>
                    <p class="font-mono text-[10px] text-(--ui-text-dimmed)">
                      {{ table.tableName }}
                    </p>
                    <p
                      v-if="table.error"
                      class="mt-1 text-[10px] text-rose-600"
                    >
                      {{ table.error }}
                    </p>
                  </td>
                  <td class="px-2 py-1.5 text-right font-mono text-(--ui-text)">
                    {{ formatNumber(table.sourceRows) }}
                  </td>
                  <td class="px-2 py-1.5 text-right font-mono text-(--ui-text)">
                    {{ formatNumber(table.targetRows) }}
                  </td>
                  <td class="px-2 py-1.5 text-right">
                    <p
                      :class="
                        table.contentMatched ? 'text-emerald-600' : (
                          'text-rose-600'
                        )
                      "
                    >
                      {{ table.contentMatched ? '一致' : '不一致' }}
                    </p>
                    <p class="font-mono text-[10px] text-(--ui-text-dimmed)">
                      {{ formatHash(table.sourceHash) }} /
                      {{ formatHash(table.targetHash) }}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div
          v-if="migrationResult.success"
          class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-2"
        >
          <label class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
            <NCheckbox v-model:checked="confirmSwitchDatabase" />
            <span>我确认要将当前数据库配置切换到目标库</span>
          </label>
          <NButton
            size="small"
            type="info"
            :disabled="!canSwitchDatabase"
            :loading="switchingDatabase"
            @click="switchDatabase"
          >
            <template #icon>
              <Icon icon="lucide:database" />
            </template>
            切换当前库
          </NButton>
        </div>
        <p
          v-if="migrationSwitchResult"
          class="text-xs text-emerald-600"
        >
          {{
            migrationSwitchResult.alreadyActive ? '当前配置已指向目标库。' : (
              '当前数据库配置已切换。'
            )
          }}
        </p>
      </div>
    </div>
  </div>
</template>

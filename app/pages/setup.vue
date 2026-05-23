<script setup lang="ts">
definePageMeta({ layout: 'setup' })

const { t } = useI18n()
const step = shallowRef(1)
const loading = shallowRef(false)
const error = shallowRef('')
const showError = shallowRef(false)

const form = reactive({
  database: {
    type: 'sqlite' as 'sqlite' | 'mysql',
    sqlite: { path: './data/novel.db' },
    mysql: { host: 'localhost', port: 3306, user: 'root', password: '', database: 'ai_novel' },
  },
  admin: { username: '', password: '', confirmPassword: '' },
  site: { name: 'AI 小说写作平台', description: '' },
})

const steps = computed(() => [
  { title: t('setup.database'), icon: 'lucide:database' },
  { title: t('setup.adminAccount'), icon: 'lucide:user' },
  { title: t('setup.siteInfo'), icon: 'lucide:settings' },
  { title: t('setup.complete'), icon: 'lucide:check-circle' },
])

function showErrorMsg(msg: string) {
  error.value = msg
  showError.value = true
  setTimeout(() => { showError.value = false }, 4000)
}

async function testDbConnection() {
  loading.value = true
  error.value = ''
  showError.value = false
  try {
    const config = form.database.type === 'sqlite'
      ? { type: 'sqlite' as const, sqlite: form.database.sqlite }
      : { type: 'mysql' as const, mysql: form.database.mysql }
    const res = await $fetch<{ success: boolean; error?: string }>('/api/setup/test-db', {
      method: 'POST',
      body: config,
    })
    if (!res.success) {
      showErrorMsg(res.error || t('setup.connectionFailed'))
      return false
    }
    return true
  } catch (e: any) {
    showErrorMsg(e.data?.message || e.message || t('setup.connectionFailed'))
    return false
  } finally {
    loading.value = false
  }
}

async function nextStep() {
  error.value = ''
  showError.value = false

  if (step.value === 1) {
    const ok = await testDbConnection()
    if (!ok) return
  }

  if (step.value === 2) {
    if (form.admin.username.length < 3) {
      showErrorMsg(t('setup.usernameMinLength'))
      return
    }
    if (!form.admin.password) {
      showErrorMsg(t('setup.passwordRequired'))
      return
    }
    if (form.admin.password !== form.admin.confirmPassword) {
      showErrorMsg(t('setup.passwordMismatch'))
      return
    }
  }

  if (step.value === 3) {
    await submitSetup()
    return
  }

  step.value++
}

async function submitSetup() {
  loading.value = true
  error.value = ''
  showError.value = false
  try {
    await $fetch('/api/setup/init', {
      method: 'POST',
      body: {
        database: form.database.type === 'sqlite'
          ? { type: 'sqlite', sqlite: form.database.sqlite }
          : { type: 'mysql', mysql: form.database.mysql },
        admin: { username: form.admin.username, password: form.admin.password },
        site: { name: form.site.name, description: form.site.description },
      },
    })
    step.value = 4
    setTimeout(() => navigateTo('/dashboard'), 2000)
  } catch (e: any) {
    showErrorMsg(e.data?.message || e.message || 'Setup failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-500/10">
        <Icon icon="lucide:pen-tool" class="size-6 text-primary-500" />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)">
        {{ t('setup.title') }}
      </h1>
      <p class="mt-1.5 text-sm text-(--ui-text-muted)">
        {{ t('setup.subtitle') }}
      </p>
    </div>

    <!-- Step Indicator -->
    <div class="flex items-center justify-center gap-2">
      <template v-for="(s, i) in steps" :key="i">
        <div
          class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors"
          :class="step > i + 1 ? 'bg-emerald-500/10 text-emerald-600' : step === i + 1 ? 'bg-primary-500/10 text-primary-600' : 'bg-(--ui-bg-muted) text-(--ui-text-dimmed)'"
        >
          <Icon :icon="s.icon" class="size-3.5" />
          <span class="hidden sm:inline">{{ s.title }}</span>
        </div>
        <div v-if="i < steps.length - 1" class="h-px w-6 bg-(--ui-border)" />
      </template>
    </div>

    <!-- Error -->
    <Transition name="slide-fade">
      <div v-if="showError" class="liquid-panel flex items-center gap-2.5 p-3 text-sm text-red-600 dark:text-red-400">
        <Icon icon="lucide:alert-circle" class="size-4 shrink-0" />
        <span>{{ error }}</span>
      </div>
    </Transition>

    <!-- Step 1: Database -->
    <div v-if="step === 1" class="space-y-4">
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.dbType') }}</label>
        <NRadioGroup v-model:value="form.database.type">
          <NRadio value="sqlite">{{ t('setup.dbSqlite') }}</NRadio>
          <NRadio value="mysql">{{ t('setup.dbMysql') }}</NRadio>
        </NRadioGroup>
      </div>

      <div v-if="form.database.type === 'sqlite'" class="space-y-3">
        <div class="space-y-1.5">
          <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.sqlitePath') }}</label>
          <NInput v-model:value="form.database.sqlite.path" placeholder="./data/novel.db">
            <template #prefix><Icon icon="lucide:folder" class="text-(--ui-text-dimmed)" /></template>
          </NInput>
          <p class="text-xs text-(--ui-text-dimmed)">{{ t('setup.sqlitePathHint') }}</p>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.mysqlHost') }}</label>
            <NInput v-model:value="form.database.mysql.host" placeholder="localhost" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.mysqlPort') }}</label>
            <NInputNumber v-model:value="form.database.mysql.port" :min="1" :max="65535" placeholder="3306" class="w-full" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.mysqlUser') }}</label>
            <NInput v-model:value="form.database.mysql.user" placeholder="root" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.mysqlPassword') }}</label>
            <NInput v-model:value="form.database.mysql.password" type="password" show-password-on="click" />
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.mysqlDatabase') }}</label>
          <NInput v-model:value="form.database.mysql.database" placeholder="ai_novel" />
        </div>
      </div>
    </div>

    <!-- Step 2: Admin Account -->
    <div v-if="step === 2" class="space-y-4">
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.adminUsername') }}</label>
        <NInput v-model:value="form.admin.username" :placeholder="t('setup.usernamePlaceholder')">
          <template #prefix><Icon icon="lucide:user" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.adminPassword') }}</label>
        <NInput v-model:value="form.admin.password" type="password" show-password-on="click" :placeholder="t('setup.passwordPlaceholder')">
          <template #prefix><Icon icon="lucide:lock" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.confirmPassword') }}</label>
        <NInput v-model:value="form.admin.confirmPassword" type="password" show-password-on="click" :placeholder="t('setup.confirmPasswordPlaceholder')">
          <template #prefix><Icon icon="lucide:lock" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <p class="text-xs text-(--ui-text-dimmed)">{{ t('setup.passwordHint') }}</p>
    </div>

    <!-- Step 3: Site Info -->
    <div v-if="step === 3" class="space-y-4">
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.siteName') }}</label>
        <NInput v-model:value="form.site.name" :placeholder="t('setup.siteNamePlaceholder')">
          <template #prefix><Icon icon="lucide:globe" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('setup.siteDescription') }}</label>
        <NInput v-model:value="form.site.description" type="textarea" :rows="3" :placeholder="t('setup.siteDescPlaceholder')" />
      </div>
    </div>

    <!-- Step 4: Complete -->
    <div v-if="step === 4" class="py-8 text-center">
      <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
        <Icon icon="lucide:check-circle" class="size-8 text-emerald-500" />
      </div>
      <h2 class="text-xl font-semibold text-(--ui-text-highlighted)">
        {{ t('setup.setupComplete') }}
      </h2>
      <p class="mt-2 text-sm text-(--ui-text-muted)">
        {{ t('setup.redirecting') }}
      </p>
    </div>

    <!-- Navigation -->
    <div v-if="step < 4" class="flex items-center justify-between pt-2">
      <NButton v-if="step > 1" quaternary @click="step--">
        <template #icon><Icon icon="lucide:arrow-left" /></template>
        {{ t('common.back') }}
      </NButton>
      <div v-else />
      <NButton type="primary" :loading="loading" @click="nextStep">
        {{ step === 3 ? t('setup.finish') : t('common.next') }}
        <template #icon><Icon :icon="step === 3 ? 'lucide:check' : 'lucide:arrow-right'" /></template>
      </NButton>
    </div>
  </div>
</template>

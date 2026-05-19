<script setup lang="ts">
definePageMeta({ layout: 'setup' })

const { t } = useI18n()
const step = ref(1)
const loading = ref(false)
const error = ref('')

const form = reactive({
  database: {
    type: 'sqlite' as 'sqlite' | 'mysql',
    sqlite: { path: './data/novel.db' },
    mysql: { host: 'localhost', port: 3306, user: 'root', password: '', database: 'ai_novel' },
  },
  admin: { username: '', password: '', confirmPassword: '' },
  site: { name: 'AI Novel Writer', description: '' },
})

const steps = computed(() => [
  { title: t('setup.database'), icon: 'i-lucide-database' },
  { title: t('setup.adminAccount'), icon: 'i-lucide-user' },
  { title: t('setup.siteInfo'), icon: 'i-lucide-settings' },
  { title: t('setup.complete'), icon: 'i-lucide-check-circle' },
])

async function testDbConnection() {
  loading.value = true
  error.value = ''
  try {
    const config = form.database.type === 'sqlite'
      ? { type: 'sqlite' as const, sqlite: form.database.sqlite }
      : { type: 'mysql' as const, mysql: form.database.mysql }
    const res = await $fetch<{ success: boolean; error?: string }>('/api/setup/test-db', {
      method: 'POST',
      body: config,
    })
    if (!res.success) {
      error.value = res.error || 'Connection failed'
      return false
    }
    return true
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Connection test failed'
    return false
  } finally {
    loading.value = false
  }
}

async function nextStep() {
  error.value = ''

  if (step.value === 1) {
    const ok = await testDbConnection()
    if (!ok) return
  }

  if (step.value === 2) {
    if (form.admin.username.length < 3) {
      error.value = t('setup.usernameMinLength')
      return
    }
    if (form.admin.password.length < 6) {
      error.value = t('setup.passwordMinLength')
      return
    }
    if (form.admin.password !== form.admin.confirmPassword) {
      error.value = t('setup.passwordMismatch')
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
    error.value = e.data?.message || e.message || 'Setup failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {{ t('setup.title') }}
      </h1>
      <p class="mt-2 text-gray-500 dark:text-gray-400">
        {{ t('setup.subtitle') }}
      </p>
    </div>

    <!-- Step Indicator -->
    <div class="flex items-center justify-center gap-2">
      <template v-for="(s, i) in steps" :key="i">
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors"
          :class="step > i + 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : step === i + 1 ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'"
        >
          <UIcon :name="s.icon" class="w-4 h-4" />
          <span class="hidden sm:inline">{{ s.title }}</span>
        </div>
        <div v-if="i < steps.length - 1" class="w-8 h-px bg-gray-200 dark:bg-gray-700" />
      </template>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Step 1: Database -->
    <div v-if="step === 1" class="space-y-6">
      <UFormField :label="t('setup.dbType')">
        <URadioGroup
          v-model="form.database.type"
          :items="[
            { label: 'SQLite (' + t('setup.recommended') + ')', value: 'sqlite' },
            { label: 'MySQL', value: 'mysql' },
          ]"
        />
      </UFormField>

      <div v-if="form.database.type === 'sqlite'" class="space-y-4">
        <UFormField :label="t('setup.sqlitePath')">
          <UInput v-model="form.database.sqlite.path" placeholder="./data/novel.db" />
        </UFormField>
      </div>

      <div v-else class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="t('setup.mysqlHost')">
            <UInput v-model="form.database.mysql.host" placeholder="localhost" />
          </UFormField>
          <UFormField :label="t('setup.mysqlPort')">
            <UInput v-model.number="form.database.mysql.port" type="number" placeholder="3306" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="t('setup.mysqlUser')">
            <UInput v-model="form.database.mysql.user" placeholder="root" />
          </UFormField>
          <UFormField :label="t('setup.mysqlPassword')">
            <UInput v-model="form.database.mysql.password" type="password" />
          </UFormField>
        </div>
        <UFormField :label="t('setup.mysqlDatabase')">
          <UInput v-model="form.database.mysql.database" placeholder="ai_novel" />
        </UFormField>
      </div>
    </div>

    <!-- Step 2: Admin Account -->
    <div v-if="step === 2" class="space-y-4">
      <UFormField :label="t('setup.adminUsername')">
        <UInput v-model="form.admin.username" :placeholder="t('setup.usernamePlaceholder')" />
      </UFormField>
      <UFormField :label="t('setup.adminPassword')">
        <UInput v-model="form.admin.password" type="password" :placeholder="t('setup.passwordPlaceholder')" />
      </UFormField>
      <UFormField :label="t('setup.confirmPassword')">
        <UInput v-model="form.admin.confirmPassword" type="password" :placeholder="t('setup.confirmPasswordPlaceholder')" />
      </UFormField>
    </div>

    <!-- Step 3: Site Info -->
    <div v-if="step === 3" class="space-y-4">
      <UFormField :label="t('setup.siteName')">
        <UInput v-model="form.site.name" :placeholder="t('setup.siteNamePlaceholder')" />
      </UFormField>
      <UFormField :label="t('setup.siteDescription')">
        <UTextarea v-model="form.site.description" :placeholder="t('setup.siteDescPlaceholder')" :rows="3" />
      </UFormField>
    </div>

    <!-- Step 4: Complete -->
    <div v-if="step === 4" class="text-center py-8">
      <UIcon name="i-lucide-check-circle" class="w-16 h-16 text-green-500 mx-auto" />
      <h2 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
        {{ t('setup.setupComplete') }}
      </h2>
      <p class="mt-2 text-gray-500 dark:text-gray-400">
        {{ t('setup.redirecting') }}
      </p>
    </div>

    <!-- Navigation -->
    <div v-if="step < 4" class="flex justify-between">
      <UButton
        v-if="step > 1"
        variant="ghost"
        @click="step--"
      >
        {{ t('common.back') }}
      </UButton>
      <div v-else />
      <UButton
        :loading="loading"
        @click="nextStep"
      >
        {{ step === 3 ? t('setup.finish') : t('common.next') }}
      </UButton>
    </div>
  </div>
</template>

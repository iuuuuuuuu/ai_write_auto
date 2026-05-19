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

const totalSteps = 4

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
    setTimeout(() => navigateTo('/dashboard'), 2500)
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Setup failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="text-center mb-10">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-5">
        <UIcon name="i-lucide-pen-tool" class="w-7 h-7 text-primary-400" />
      </div>
      <h1 class="text-2xl font-semibold text-white">
        {{ t('setup.title') }}
      </h1>
      <p class="mt-2 text-sm text-(--ui-text-muted)">
        {{ t('setup.subtitle') }}
      </p>
    </div>

    <!-- Progress Steps -->
    <div class="flex items-center justify-center gap-0 mb-10">
      <template v-for="i in totalSteps" :key="i">
        <div class="flex flex-col items-center">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 border"
            :class="[
              step > i
                ? 'bg-primary-500 border-primary-500 text-white'
                : step === i
                  ? 'bg-primary-500/15 border-primary-500/50 text-primary-300'
                  : 'bg-(--ui-bg-elevated) border-(--ui-border) text-(--ui-text-dimmed)'
            ]"
          >
            <UIcon v-if="step > i" name="i-lucide-check" class="w-3.5 h-3.5" />
            <span v-else>{{ i }}</span>
          </div>
        </div>
        <div
          v-if="i < totalSteps"
          class="w-12 h-px transition-colors duration-300"
          :class="step > i ? 'bg-primary-500/60' : 'bg-(--ui-border)'"
        />
      </template>
    </div>

    <!-- Error -->
    <Transition name="slide-fade">
      <div v-if="error" class="mb-6 flex items-start gap-2.5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
        <UIcon name="i-lucide-alert-circle" class="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
        <span>{{ error }}</span>
      </div>
    </Transition>

    <!-- Step Content -->
    <div class="min-h-[260px]">
      <Transition name="slide-fade" mode="out-in">
        <!-- Step 1: Database -->
        <div v-if="step === 1" key="s1" class="space-y-6">
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="opt in [
                { value: 'sqlite', label: 'SQLite', desc: t('setup.recommended'), icon: 'i-lucide-hard-drive' },
                { value: 'mysql', label: 'MySQL', desc: t('setup.production') || 'Production', icon: 'i-lucide-database' },
              ]"
              :key="opt.value"
              class="relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-150 text-left cursor-pointer"
              :class="form.database.type === opt.value
                ? 'bg-primary-500/8 border-primary-500/40'
                : 'bg-(--ui-bg-elevated) border-(--ui-border) hover:border-(--ui-border-accented)'"
              @click="form.database.type = opt.value as 'sqlite' | 'mysql'"
            >
              <UIcon
                :name="opt.icon"
                class="w-5 h-5"
                :class="form.database.type === opt.value ? 'text-primary-400' : 'text-(--ui-text-dimmed)'"
              />
              <div>
                <p class="text-sm font-medium" :class="form.database.type === opt.value ? 'text-white' : 'text-(--ui-text)'">{{ opt.label }}</p>
                <p class="text-xs mt-0.5" :class="form.database.type === opt.value ? 'text-primary-300/70' : 'text-(--ui-text-dimmed)'">{{ opt.desc }}</p>
              </div>
              <div v-if="form.database.type === opt.value" class="absolute top-3 right-3 w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center">
                <UIcon name="i-lucide-check" class="w-2.5 h-2.5 text-white" />
              </div>
            </button>
          </div>

          <Transition name="slide-fade" mode="out-in">
            <div v-if="form.database.type === 'sqlite'" key="sqlite" class="space-y-2">
              <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.sqlitePath') }}</label>
              <UInput v-model="form.database.sqlite.path" placeholder="./data/novel.db" size="lg" icon="i-lucide-folder" />
              <p class="text-xs text-(--ui-text-dimmed)">{{ t('setup.sqlitePathHint') }}</p>
            </div>
            <div v-else key="mysql" class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.mysqlHost') }}</label>
                  <UInput v-model="form.database.mysql.host" placeholder="localhost" size="lg" />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.mysqlPort') }}</label>
                  <UInput v-model.number="form.database.mysql.port" type="number" placeholder="3306" size="lg" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.mysqlUser') }}</label>
                  <UInput v-model="form.database.mysql.user" placeholder="root" size="lg" />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.mysqlPassword') }}</label>
                  <UInput v-model="form.database.mysql.password" type="password" size="lg" />
                </div>
              </div>
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.mysqlDatabase') }}</label>
                <UInput v-model="form.database.mysql.database" placeholder="ai_novel" size="lg" />
              </div>
            </div>
          </Transition>
        </div>

        <!-- Step 2: Admin -->
        <div v-else-if="step === 2" key="s2" class="space-y-5">
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.adminUsername') }}</label>
            <UInput v-model="form.admin.username" :placeholder="t('setup.usernamePlaceholder')" size="lg" icon="i-lucide-user" autocomplete="username" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.adminPassword') }}</label>
            <UInput v-model="form.admin.password" type="password" :placeholder="t('setup.passwordPlaceholder')" size="lg" icon="i-lucide-lock" autocomplete="new-password" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.confirmPassword') }}</label>
            <UInput v-model="form.admin.confirmPassword" type="password" :placeholder="t('setup.confirmPasswordPlaceholder')" size="lg" icon="i-lucide-lock" autocomplete="new-password" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed) pt-1">{{ t('setup.passwordHint') }}</p>
        </div>

        <!-- Step 3: Site -->
        <div v-else-if="step === 3" key="s3" class="space-y-5">
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.siteName') }}</label>
            <UInput v-model="form.site.name" :placeholder="t('setup.siteNamePlaceholder')" size="lg" icon="i-lucide-type" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('setup.siteDescription') }}</label>
            <UTextarea v-model="form.site.description" :placeholder="t('setup.siteDescPlaceholder')" :rows="3" size="lg" />
          </div>
        </div>

        <!-- Step 4: Done -->
        <div v-else-if="step === 4" key="s4" class="text-center py-8">
          <Transition name="scale-in" appear>
            <div>
              <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/25 mb-4">
                <UIcon name="i-lucide-check" class="w-7 h-7 text-green-400" />
              </div>
              <h2 class="text-lg font-semibold text-white">{{ t('setup.setupComplete') }}</h2>
              <p class="mt-1.5 text-sm text-(--ui-text-muted)">{{ t('setup.redirecting') }}</p>
              <div class="mt-5 mx-auto w-40 h-1 rounded-full bg-(--ui-bg-elevated) overflow-hidden">
                <div class="h-full bg-primary-500/70 rounded-full animate-[progress_2.5s_ease-in-out_forwards]" />
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </div>

    <!-- Footer Actions -->
    <div v-if="step < 4" class="flex items-center justify-between mt-8 pt-6 border-t border-(--ui-border)">
      <UButton
        v-if="step > 1"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        @click="step--"
      >
        {{ t('common.back') }}
      </UButton>
      <div v-else />
      <UButton
        :loading="loading"
        trailing-icon="i-lucide-arrow-right"
        @click="nextStep"
      >
        {{ step === 3 ? t('setup.finish') : t('common.next') }}
      </UButton>
    </div>
  </div>
</template>


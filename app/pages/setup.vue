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
  { title: t('setup.adminAccount'), icon: 'i-lucide-shield' },
  { title: t('setup.siteInfo'), icon: 'i-lucide-globe' },
  { title: t('setup.complete'), icon: 'i-lucide-sparkles' },
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
    setTimeout(() => navigateTo('/dashboard'), 2500)
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Setup failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Branded Header -->
    <div class="text-center space-y-3">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20 mb-2">
        <UIcon name="i-lucide-pen-tool" class="w-7 h-7 text-white" />
      </div>
      <h1 class="text-2xl font-bold text-white tracking-tight">
        {{ t('setup.title') }}
      </h1>
      <p class="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
        {{ t('setup.subtitle') }}
      </p>
    </div>

    <!-- Step Indicator -->
    <div class="flex items-center justify-between px-2">
      <template v-for="(s, i) in steps" :key="i">
        <div class="flex flex-col items-center gap-1.5 relative z-10">
          <div
            class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300"
            :class="[
              step > i + 1
                ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/30'
                : step === i + 1
                  ? 'bg-primary-500/20 text-primary-400 ring-2 ring-primary-500/40 shadow-lg shadow-primary-500/10'
                  : 'bg-gray-800/60 text-gray-500 ring-1 ring-gray-700/50'
            ]"
          >
            <UIcon v-if="step > i + 1" name="i-lucide-check" class="w-4 h-4" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span
            class="text-xs font-medium transition-colors duration-300 hidden sm:block"
            :class="step >= i + 1 ? 'text-gray-300' : 'text-gray-600'"
          >
            {{ s.title }}
          </span>
        </div>
        <div
          v-if="i < steps.length - 1"
          class="flex-1 h-px mx-2 transition-colors duration-500 -mt-4 sm:-mt-6"
          :class="step > i + 1 ? 'bg-green-500/40' : 'bg-gray-700/50'"
        />
      </template>
    </div>

    <!-- Error Alert -->
    <Transition name="slide-fade">
      <div v-if="error" class="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <UIcon name="i-lucide-alert-circle" class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <p class="text-sm text-red-300 leading-relaxed">{{ error }}</p>
      </div>
    </Transition>

    <!-- Step Content with Transitions -->
    <div class="min-h-[280px]">
      <Transition name="slide-fade" mode="out-in">
        <!-- Step 1: Database -->
        <div v-if="step === 1" key="step1" class="space-y-6">
          <p class="text-sm text-gray-400">{{ t('setup.dbType') }}</p>

          <!-- Database Type Cards -->
          <div class="grid grid-cols-2 gap-3">
            <button
              class="relative p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer group"
              :class="form.database.type === 'sqlite'
                ? 'bg-primary-500/10 border-primary-500/40 ring-1 ring-primary-500/20'
                : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600/60 hover:bg-gray-800/60'"
              @click="form.database.type = 'sqlite'"
            >
              <div class="flex flex-col gap-2">
                <UIcon name="i-lucide-hard-drive" class="w-6 h-6" :class="form.database.type === 'sqlite' ? 'text-primary-400' : 'text-gray-500 group-hover:text-gray-400'" />
                <span class="font-medium text-sm" :class="form.database.type === 'sqlite' ? 'text-white' : 'text-gray-300'">SQLite</span>
                <span class="text-xs" :class="form.database.type === 'sqlite' ? 'text-primary-300/70' : 'text-gray-500'">{{ t('setup.recommended') }}</span>
              </div>
              <div v-if="form.database.type === 'sqlite'" class="absolute top-3 right-3">
                <div class="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                  <UIcon name="i-lucide-check" class="w-3 h-3 text-white" />
                </div>
              </div>
            </button>

            <button
              class="relative p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer group"
              :class="form.database.type === 'mysql'
                ? 'bg-primary-500/10 border-primary-500/40 ring-1 ring-primary-500/20'
                : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600/60 hover:bg-gray-800/60'"
              @click="form.database.type = 'mysql'"
            >
              <div class="flex flex-col gap-2">
                <UIcon name="i-lucide-database" class="w-6 h-6" :class="form.database.type === 'mysql' ? 'text-primary-400' : 'text-gray-500 group-hover:text-gray-400'" />
                <span class="font-medium text-sm" :class="form.database.type === 'mysql' ? 'text-white' : 'text-gray-300'">MySQL</span>
                <span class="text-xs" :class="form.database.type === 'mysql' ? 'text-primary-300/70' : 'text-gray-500'">{{ t('setup.production') || 'Production' }}</span>
              </div>
              <div v-if="form.database.type === 'mysql'" class="absolute top-3 right-3">
                <div class="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                  <UIcon name="i-lucide-check" class="w-3 h-3 text-white" />
                </div>
              </div>
            </button>
          </div>

          <!-- SQLite Config -->
          <Transition name="slide-fade" mode="out-in">
            <div v-if="form.database.type === 'sqlite'" key="sqlite" class="space-y-2">
              <label class="text-sm font-medium text-gray-300">{{ t('setup.sqlitePath') }}</label>
              <UInput
                v-model="form.database.sqlite.path"
                placeholder="./data/novel.db"
                size="lg"
                icon="i-lucide-folder"
              />
              <p class="text-xs text-gray-500">{{ t('setup.sqlitePathHint') || 'Relative to project root. Created automatically.' }}</p>
            </div>

            <!-- MySQL Config -->
            <div v-else key="mysql" class="space-y-4">
              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-2 space-y-1.5">
                  <label class="text-sm font-medium text-gray-300">{{ t('setup.mysqlHost') }}</label>
                  <UInput v-model="form.database.mysql.host" placeholder="localhost" size="lg" />
                </div>
                <div class="space-y-1.5">
                  <label class="text-sm font-medium text-gray-300">{{ t('setup.mysqlPort') }}</label>
                  <UInput v-model.number="form.database.mysql.port" type="number" placeholder="3306" size="lg" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="text-sm font-medium text-gray-300">{{ t('setup.mysqlUser') }}</label>
                  <UInput v-model="form.database.mysql.user" placeholder="root" size="lg" icon="i-lucide-user" />
                </div>
                <div class="space-y-1.5">
                  <label class="text-sm font-medium text-gray-300">{{ t('setup.mysqlPassword') }}</label>
                  <UInput v-model="form.database.mysql.password" type="password" size="lg" icon="i-lucide-lock" />
                </div>
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-gray-300">{{ t('setup.mysqlDatabase') }}</label>
                <UInput v-model="form.database.mysql.database" placeholder="ai_novel" size="lg" icon="i-lucide-database" />
              </div>
            </div>
          </Transition>
        </div>

        <!-- Step 2: Admin Account -->
        <div v-else-if="step === 2" key="step2" class="space-y-5">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-gray-300">{{ t('setup.adminUsername') }}</label>
            <UInput
              v-model="form.admin.username"
              :placeholder="t('setup.usernamePlaceholder')"
              size="lg"
              icon="i-lucide-user"
              autocomplete="username"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-gray-300">{{ t('setup.adminPassword') }}</label>
            <UInput
              v-model="form.admin.password"
              type="password"
              :placeholder="t('setup.passwordPlaceholder')"
              size="lg"
              icon="i-lucide-lock"
              autocomplete="new-password"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-gray-300">{{ t('setup.confirmPassword') }}</label>
            <UInput
              v-model="form.admin.confirmPassword"
              type="password"
              :placeholder="t('setup.confirmPasswordPlaceholder')"
              size="lg"
              icon="i-lucide-lock"
              autocomplete="new-password"
            />
          </div>
          <p class="text-xs text-gray-500 flex items-center gap-1.5">
            <UIcon name="i-lucide-info" class="w-3.5 h-3.5" />
            {{ t('setup.passwordHint') || 'At least 6 characters. This will be the super admin account.' }}
          </p>
        </div>

        <!-- Step 3: Site Info -->
        <div v-else-if="step === 3" key="step3" class="space-y-5">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-gray-300">{{ t('setup.siteName') }}</label>
            <UInput
              v-model="form.site.name"
              :placeholder="t('setup.siteNamePlaceholder')"
              size="lg"
              icon="i-lucide-type"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-gray-300">{{ t('setup.siteDescription') }}</label>
            <UTextarea
              v-model="form.site.description"
              :placeholder="t('setup.siteDescPlaceholder')"
              :rows="3"
              size="lg"
            />
          </div>
        </div>

        <!-- Step 4: Complete -->
        <div v-else-if="step === 4" key="step4" class="text-center py-10">
          <Transition name="scale-in" appear>
            <div class="space-y-4">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/15 ring-2 ring-green-500/30">
                <UIcon name="i-lucide-check" class="w-8 h-8 text-green-400" />
              </div>
              <h2 class="text-xl font-semibold text-white">
                {{ t('setup.setupComplete') }}
              </h2>
              <p class="text-sm text-gray-400">
                {{ t('setup.redirecting') }}
              </p>
              <div class="flex justify-center pt-2">
                <div class="w-32 h-1 rounded-full bg-gray-800 overflow-hidden">
                  <div class="h-full bg-green-500/60 rounded-full animate-[progress_2.5s_ease-in-out_forwards]" />
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </div>

    <!-- Navigation -->
    <div v-if="step < 4" class="flex items-center justify-between pt-2 border-t border-gray-800/50">
      <UButton
        v-if="step > 1"
        variant="ghost"
        color="neutral"
        size="md"
        icon="i-lucide-arrow-left"
        @click="step--"
      >
        {{ t('common.back') }}
      </UButton>
      <div v-else />
      <UButton
        size="md"
        :loading="loading"
        trailing-icon="i-lucide-arrow-right"
        @click="nextStep"
      >
        {{ step === 3 ? t('setup.finish') : t('common.next') }}
      </UButton>
    </div>
  </div>
</template>

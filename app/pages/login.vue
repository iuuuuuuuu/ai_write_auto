<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const { login } = useAuth()

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')
const showError = ref(false)

async function handleLogin() {
  loading.value = true
  error.value = ''
  showError.value = false
  try {
    await login(form.username, form.password)
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusCode === 401 ? t('auth.invalidCredentials') : t('auth.loginFailed')
    showError.value = true
    setTimeout(() => { showError.value = false }, 4000)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <div class="lg:hidden flex items-center gap-2.5 mb-6">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center"
           style="background: linear-gradient(135deg, var(--ui-primary-400), var(--ui-primary-600));">
        <Icon icon="lucide:pen-tool" class="w-4.5 h-4.5 text-white" />
      </div>
      <span class="text-base font-semibold text-(--ui-text)">AI 小说写作</span>
    </div>

    <div class="mb-5">
      <h1 class="text-xl font-bold text-(--ui-text-highlighted)">{{ t('auth.loginTitle') }}</h1>
      <p class="mt-1 text-sm text-(--ui-text-muted)">{{ t('auth.loginSubtitle') }}</p>
    </div>

    <Transition name="slide-fade">
      <div v-if="showError"
           class="mb-3 flex items-center gap-2 p-2.5 rounded-lg text-sm animate-pulse-glow"
           style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.15);">
        <Icon icon="lucide:alert-circle" class="w-4 h-4 shrink-0 text-red-500" />
        <span class="text-red-600 dark:text-red-400">{{ error }}</span>
      </div>
    </Transition>

    <form class="space-y-3" @submit.prevent="handleLogin">
      <div class="space-y-1">
        <label class="block text-[11px] font-semibold text-(--ui-text-muted) uppercase tracking-wider">{{ t('auth.username') }}</label>
        <NInput v-model:value="form.username" :placeholder="t('auth.usernamePlaceholder')" size="large">
          <template #prefix><Icon icon="lucide:user" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <div class="space-y-1">
        <label class="block text-[11px] font-semibold text-(--ui-text-muted) uppercase tracking-wider">{{ t('auth.password') }}</label>
        <NInput v-model:value="form.password" type="password" show-password-on="click" :placeholder="t('auth.passwordPlaceholder')" size="large">
          <template #prefix><Icon icon="lucide:lock" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <NButton type="primary" attr-type="submit" block size="large" :loading="loading">
        {{ t('auth.loginButton') }}
      </NButton>
    </form>

    <p class="mt-4 text-center text-xs text-(--ui-text-dimmed)">
      {{ t('auth.noAccount') }}
      <NuxtLink to="/register" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">{{ t('auth.registerButton') }}</NuxtLink>
    </p>
  </div>
</template>
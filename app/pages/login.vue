<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const { login } = useAuth()

const form = reactive({
  username: '',
  password: '',
})
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await login(form.username, form.password)
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusCode === 401
      ? t('auth.invalidCredentials')
      : t('auth.loginFailed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Mobile logo (hidden on desktop where branding panel shows) -->
    <div class="lg:hidden flex items-center gap-2.5 mb-8">
      <div class="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/15 flex items-center justify-center">
        <Icon icon="lucide:pen-tool" class="w-4.5 h-4.5 text-primary-500" />
      </div>
      <span class="text-base font-semibold text-(--ui-text)">AI 小说写作</span>
    </div>

    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-(--ui-text-highlighted)">
        {{ t('auth.loginTitle') }}
      </h1>
      <p class="mt-1 text-sm text-(--ui-text-muted)">
        {{ t('auth.loginSubtitle') }}
      </p>
    </div>

    <!-- Error -->
    <Transition name="slide-fade">
      <div v-if="error" class="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/8 border border-red-500/15 text-sm text-red-600 dark:text-red-400">
        <Icon icon="lucide:alert-circle" class="w-4 h-4 shrink-0" />
        <span>{{ error }}</span>
      </div>
    </Transition>

    <!-- Form -->
    <form class="space-y-4" @submit.prevent="handleLogin">
      <div class="space-y-1.5">
        <label class="block text-xs font-medium text-(--ui-text-muted)">{{ t('auth.username') }}</label>
        <NInput
          v-model:value="form.username"
          :placeholder="t('auth.usernamePlaceholder')"
          size="large"
          autofocus
        >
          <template #prefix>
            <Icon icon="lucide:user" class="text-(--ui-text-dimmed)" />
          </template>
        </NInput>
      </div>
      <div class="space-y-1.5">
        <label class="block text-xs font-medium text-(--ui-text-muted)">{{ t('auth.password') }}</label>
        <NInput
          v-model:value="form.password"
          type="password"
          show-password-on="click"
          :placeholder="t('auth.passwordPlaceholder')"
          size="large"
        >
          <template #prefix>
            <Icon icon="lucide:lock" class="text-(--ui-text-dimmed)" />
          </template>
        </NInput>
      </div>
      <NButton type="primary" attr-type="submit" block size="large" :loading="loading">
        {{ t('auth.loginButton') }}
      </NButton>
    </form>
  </div>
</template>

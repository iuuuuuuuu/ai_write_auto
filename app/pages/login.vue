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
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 mb-4">
        <Icon icon="lucide:pen-tool" class="w-6 h-6 text-primary-400" />
      </div>
      <h1 class="text-xl font-semibold text-white">
        {{ t('auth.loginTitle') }}
      </h1>
      <p class="mt-1.5 text-sm text-(--ui-text-muted)">
        {{ t('auth.loginSubtitle') }}
      </p>
    </div>

    <!-- Error -->
    <Transition name="slide-fade">
      <div v-if="error" class="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
        <Icon icon="lucide:alert-circle" class="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
        <span>{{ error }}</span>
      </div>
    </Transition>

    <!-- Form -->
    <form class="space-y-5" @submit.prevent="handleLogin">
      <div class="space-y-1.5">
        <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('auth.username') }}</label>
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
        <label class="block text-xs font-medium text-(--ui-text-muted) uppercase tracking-wide">{{ t('auth.password') }}</label>
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
      <NButton type="primary" attr-type="submit" block size="large" :loading="loading" class="mt-2">
        {{ t('auth.loginButton') }}
      </NButton>
    </form>
  </div>
</template>

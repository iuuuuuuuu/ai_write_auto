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
    error.value = e.data?.message || t('auth.loginFailed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-7">
    <!-- Header -->
    <div class="text-center space-y-3">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20">
        <UIcon name="i-lucide-pen-tool" class="w-6 h-6 text-white" />
      </div>
      <h1 class="text-xl font-bold text-white tracking-tight">
        {{ t('auth.loginTitle') }}
      </h1>
      <p class="text-sm text-gray-400">
        {{ t('auth.loginSubtitle') }}
      </p>
    </div>

    <!-- Error -->
    <Transition name="slide-fade">
      <div v-if="error" class="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
        <UIcon name="i-lucide-alert-circle" class="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
        <p class="text-sm text-red-300">{{ error }}</p>
      </div>
    </Transition>

    <!-- Form -->
    <form class="space-y-5" @submit.prevent="handleLogin">
      <div class="space-y-1.5">
        <label class="text-sm font-medium text-gray-300">{{ t('auth.username') }}</label>
        <UInput
          v-model="form.username"
          :placeholder="t('auth.usernamePlaceholder')"
          size="lg"
          icon="i-lucide-user"
          autofocus
          autocomplete="username"
        />
      </div>
      <div class="space-y-1.5">
        <label class="text-sm font-medium text-gray-300">{{ t('auth.password') }}</label>
        <UInput
          v-model="form.password"
          type="password"
          :placeholder="t('auth.passwordPlaceholder')"
          size="lg"
          icon="i-lucide-lock"
          autocomplete="current-password"
        />
      </div>
      <UButton type="submit" block size="lg" :loading="loading" class="mt-2">
        {{ t('auth.loginButton') }}
      </UButton>
    </form>
  </div>
</template>

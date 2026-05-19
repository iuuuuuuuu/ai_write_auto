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
  <div class="w-full max-w-sm mx-auto space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('auth.login') }}
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('auth.loginSubtitle') }}
      </p>
    </div>

    <div v-if="error" class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <form class="space-y-4" @submit.prevent="handleLogin">
      <UFormField :label="t('auth.username')">
        <UInput v-model="form.username" :placeholder="t('auth.usernamePlaceholder')" autofocus />
      </UFormField>
      <UFormField :label="t('auth.password')">
        <UInput v-model="form.password" type="password" :placeholder="t('auth.passwordPlaceholder')" />
      </UFormField>
      <UButton type="submit" block :loading="loading">
        {{ t('auth.login') }}
      </UButton>
    </form>
  </div>
</template>

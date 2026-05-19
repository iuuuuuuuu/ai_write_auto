<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const { register } = useAuth()

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})
const loading = ref(false)
const error = ref('')

async function handleRegister() {
  if (form.password !== form.confirmPassword) {
    error.value = t('setup.passwordMismatch')
    return
  }
  loading.value = true
  error.value = ''
  try {
    await register(form.username, form.password)
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.message || t('common.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-sm mx-auto space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('auth.registerTitle') }}
      </h1>
    </div>

    <div v-if="error" class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <form class="space-y-4" @submit.prevent="handleRegister">
      <UFormField :label="t('auth.username')">
        <UInput v-model="form.username" :placeholder="t('auth.usernamePlaceholder')" autofocus />
      </UFormField>
      <UFormField :label="t('auth.password')">
        <UInput v-model="form.password" type="password" :placeholder="t('auth.passwordPlaceholder')" />
      </UFormField>
      <UFormField :label="t('auth.confirmPassword')">
        <UInput v-model="form.confirmPassword" type="password" />
      </UFormField>
      <UButton type="submit" block :loading="loading">
        {{ t('auth.registerButton') }}
      </UButton>
    </form>

    <p class="text-center text-sm text-gray-500">
      {{ t('auth.hasAccount') }}
      <NuxtLink to="/login" class="text-primary-600 hover:underline">{{ t('auth.loginButton') }}</NuxtLink>
    </p>
  </div>
</template>

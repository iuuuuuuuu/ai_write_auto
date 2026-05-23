<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const { register } = useAuth()

const form = reactive({ username: '', password: '', confirmPassword: '' })
const loading = shallowRef(false)
const error = shallowRef('')
const showError = shallowRef(false)

function getErrorMessage(errorValue: unknown) {
  if (typeof errorValue !== 'object' || errorValue === null || !('data' in errorValue)) return t('common.error')

  const data = (errorValue as { data?: { message?: unknown } }).data
  return typeof data?.message === 'string' ? data.message : t('common.error')
}

async function handleRegister() {
  if (form.password !== form.confirmPassword) {
    error.value = t('setup.passwordMismatch')
    showError.value = true
    return
  }
  loading.value = true
  error.value = ''
  showError.value = false
  try {
    await register(form.username, form.password)
    navigateTo('/dashboard')
  } catch (errorValue: unknown) {
    error.value = getErrorMessage(errorValue)
    showError.value = true
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="stagger-children">
    <div class="mb-8 flex items-center gap-3 lg:hidden">
      <div class="liquid-panel flex size-11 items-center justify-center rounded-[1.35rem]">
        <Icon icon="lucide:pen-tool" class="size-5 text-primary-500" />
      </div>
      <span class="text-base font-semibold text-(--ui-text-highlighted)">AI 小说写作</span>
    </div>

    <div class="mb-6">
      <p class="mb-2 text-xs uppercase tracking-[0.24em] text-primary-500/80">Start writing</p>
      <h1 class="text-3xl font-semibold tracking-[-0.05em] text-(--ui-text-highlighted)">{{ t('auth.registerTitle') }}</h1>
      <p class="mt-2 text-sm leading-6 text-(--ui-text-muted)">创建账号开始你的创作之旅</p>
    </div>

    <Transition name="slide-fade">
      <div
        v-if="showError"
        class="liquid-panel mb-4 flex items-center gap-2.5 p-3 text-sm text-red-600 dark:text-red-400"
      >
        <Icon icon="lucide:alert-circle" class="size-4 shrink-0" />
        <span>{{ error }}</span>
      </div>
    </Transition>

    <form class="space-y-4" @submit.prevent="handleRegister">
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('auth.username') }}</label>
        <NInput v-model:value="form.username" :placeholder="t('auth.usernamePlaceholder')" size="large" autofocus>
          <template #prefix><Icon icon="lucide:user" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('auth.password') }}</label>
        <NInput v-model:value="form.password" type="password" show-password-on="click" :placeholder="t('auth.passwordPlaceholder')" size="large">
          <template #prefix><Icon icon="lucide:lock" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <div class="space-y-1.5">
        <label class="block text-[11px] uppercase tracking-[0.18em] text-(--ui-text-muted)">{{ t('auth.confirmPassword') }}</label>
        <NInput v-model:value="form.confirmPassword" type="password" show-password-on="click" size="large">
          <template #prefix><Icon icon="lucide:lock" class="text-(--ui-text-dimmed)" /></template>
        </NInput>
      </div>
      <NButton type="primary" attr-type="submit" block size="large" round :loading="loading">
        {{ t('auth.registerButton') }}
      </NButton>
    </form>

    <p class="mt-5 text-center text-xs text-(--ui-text-dimmed)">
      {{ t('auth.hasAccount') }}
      <NuxtLink to="/login" class="text-primary-600 hover:underline dark:text-primary-400">{{ t('auth.loginButton') }}</NuxtLink>
    </p>
  </div>
</template>
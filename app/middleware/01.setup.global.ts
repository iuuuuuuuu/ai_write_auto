export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/setup') return

  const setupDone = useState('setup_initialized', () => false)
  if (setupDone.value) return

  try {
    const { initialized } = await $fetch<{ initialized: boolean }>('/api/setup/status')
    if (!initialized) {
      return navigateTo('/setup')
    }
    setupDone.value = true
  } catch {
    return navigateTo('/setup')
  }
})

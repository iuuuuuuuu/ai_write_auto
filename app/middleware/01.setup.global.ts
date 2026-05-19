export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/setup') return

  try {
    const { initialized } = await $fetch<{ initialized: boolean }>('/api/setup/status')
    if (!initialized) {
      return navigateTo('/setup')
    }
  } catch {
    return navigateTo('/setup')
  }
})

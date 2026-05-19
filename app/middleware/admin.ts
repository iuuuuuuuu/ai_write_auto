export default defineNuxtRouteMiddleware(async () => {
  const { user, loading, fetchUser, isAdmin } = useAuth()

  if (loading.value && !user.value) {
    await fetchUser()
  }

  if (!isAdmin.value) {
    return navigateTo('/dashboard')
  }
})

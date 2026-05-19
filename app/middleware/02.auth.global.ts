export default defineNuxtRouteMiddleware(async (to) => {
  const publicPages = ['/login', '/register', '/setup']
  if (publicPages.includes(to.path)) return

  const { user, fetchUser, loading } = useAuth()

  if (loading.value && !user.value) {
    await fetchUser()
  }

  if (!user.value) {
    return navigateTo('/login')
  }
})

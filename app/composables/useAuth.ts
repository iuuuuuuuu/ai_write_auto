interface User {
  id: number
  username: string
  role: 'admin' | 'user'
}

export function useAuth() {
  const user = useState<User | null>('auth_user', () => null)
  const loading = useState('auth_loading', () => true)

  async function fetchUser() {
    try {
      const data = await $fetch<{ user: User }>('/api/auth/me')
      user.value = data.user
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string) {
    const data = await $fetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    user.value = data.user
    return data.user
  }

  async function register(username: string, password: string) {
    const data = await $fetch<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: { username, password },
    })
    user.value = data.user
    return data.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    navigateTo('/login')
  }

  return {
    user,
    loading,
    fetchUser,
    login,
    register,
    logout,
    isAdmin: computed(() => user.value?.role === 'admin'),
    isLoggedIn: computed(() => !!user.value),
  }
}

interface User {
  id: number
  username: string
  role: 'admin' | 'user'
}

const LOCAL_STORAGE_KEYS = [
  'app-tabs-user',
  'app-tabs-admin',
  'reading_history_v1',
]

function checkDbInstance(dbInstanceId: string | null) {
  if (!import.meta.client || !dbInstanceId) return
  const stored = localStorage.getItem('db_instance_id')
  if (stored && stored !== dbInstanceId) {
    for (const key of LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key)
    }
  }
  localStorage.setItem('db_instance_id', dbInstanceId)
}

export function useAuth() {
  const user = useState<User | null>('auth_user', () => null)
  const loading = useState('auth_loading', () => true)

  async function fetchUser() {
    try {
      const data = await $fetch<{ user: User; dbInstanceId?: string | null }>('/api/auth/me', {
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
      })
      user.value = data.user
      checkDbInstance(data.dbInstanceId || null)
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string) {
    const data = await $fetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    })
    user.value = data.user
    loading.value = false
    return data.user
  }

  async function register(username: string, password: string) {
    const data = await $fetch<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: { username, password }
    })
    user.value = data.user
    loading.value = false
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
    isLoggedIn: computed(() => !!user.value)
  }
}

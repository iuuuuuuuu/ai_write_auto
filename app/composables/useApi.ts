type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface ApiOptions<M extends HttpMethod = 'GET'> {
  method?: M
  body?: any
  query?: Record<string, any>
  silent?: boolean
  successMessage?: string
}

export function useApi() {
  const message = useMessage()

  async function request<T = any>(url: string, options: ApiOptions<HttpMethod> = {}): Promise<T> {
    const { silent = false, successMessage, ...fetchOptions } = options
    try {
      const result = await $fetch<T>(url, fetchOptions as any)
      if (successMessage) message.success(successMessage)
      return result as T
    } catch (error: any) {
      if (!silent) {
        const msg = extractErrorMessage(error)
        message.error(msg)
      }
      throw error
    }
  }

  function get<T = any>(url: string, options: Omit<ApiOptions<'GET'>, 'method'> = {}) {
    return request<T>(url, { ...options, method: 'GET' })
  }

  function post<T = any>(url: string, body?: any, options: Omit<ApiOptions<'POST'>, 'method' | 'body'> = {}) {
    return request<T>(url, { ...options, method: 'POST', body })
  }

  function put<T = any>(url: string, body?: any, options: Omit<ApiOptions<'PUT'>, 'method' | 'body'> = {}) {
    return request<T>(url, { ...options, method: 'PUT', body })
  }

  function del<T = any>(url: string, options: Omit<ApiOptions<'DELETE'>, 'method'> = {}) {
    return request<T>(url, { ...options, method: 'DELETE' })
  }

  return { request, get, post, put, del }
}

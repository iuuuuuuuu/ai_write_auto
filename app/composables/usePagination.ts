import type { PaginatedResponse } from '../../server/utils/pagination'

interface UsePaginationOptions {
  url: string | Ref<string>
  pageSize?: number
  params?: Ref<Record<string, any>> | ComputedRef<Record<string, any>>
  immediate?: boolean
}

export function usePagination<T>(options: UsePaginationOptions) {
  const { url, pageSize = 20, params, immediate = true } = options

  const page = ref(1)
  const currentPageSize = ref(pageSize)
  const items = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const totalPages = ref(0)
  const loading = ref(false)

  async function fetchData() {
    loading.value = true
    try {
      const queryParams: Record<string, any> = {
        page: page.value,
        pageSize: currentPageSize.value,
        ...unref(params),
      }

      const resolvedUrl = unref(url)
      const data = await $fetch<PaginatedResponse<T>>(resolvedUrl, {
        params: queryParams,
      })

      items.value = data.items
      total.value = data.total
      totalPages.value = data.totalPages
    } catch (e) {
      items.value = []
      total.value = 0
      totalPages.value = 0
      throw e
    } finally {
      loading.value = false
    }
  }

  function goToPage(p: number) {
    page.value = p
    fetchData()
  }

  function updatePageSize(size: number) {
    currentPageSize.value = size
    page.value = 1
    fetchData()
  }

  function refresh() {
    fetchData()
  }

  function resetAndFetch() {
    page.value = 1
    fetchData()
  }

  if (params) {
    watch(params, () => {
      page.value = 1
      fetchData()
    }, { deep: true })
  }

  if (immediate) {
    fetchData()
  }

  return {
    items,
    total,
    totalPages,
    page,
    pageSize: currentPageSize,
    loading,
    goToPage,
    updatePageSize,
    refresh,
    resetAndFetch,
  }
}

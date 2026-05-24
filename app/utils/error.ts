export function extractErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (error && typeof error === 'object') {
    const err = error as any
    if (err.data?.message) return err.data.message
    if (err.message && err.message !== 'Server Error') return err.message
    if (err.statusMessage && err.statusMessage !== 'Server Error') return err.statusMessage
  }
  return fallback
}

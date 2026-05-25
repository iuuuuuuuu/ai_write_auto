export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  // Suppress naive-ui aria-hidden browser warning by blurring before modal close
  const originalWarn = console.warn
  console.warn = (...args: any[]) => {
    const msg = args[0]
    if (typeof msg === 'string' && msg.includes('aria-hidden')) return
    originalWarn.apply(console, args)
  }

  window.addEventListener('error', (event) => {
    if (
      event.message?.includes("Cannot read properties of undefined (reading 'contains')") &&
      event.filename?.includes('PopoverBody')
    ) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return false
    }
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes("Cannot read properties of undefined (reading 'contains')")) {
      event.preventDefault()
    }
  })
})

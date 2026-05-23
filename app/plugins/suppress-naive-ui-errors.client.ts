export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

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

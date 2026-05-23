export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.warnHandler = (msg, _instance, _trace) => {
    if (msg.includes('invoked outside of the render function')) {
      return
    }
    console.warn(msg)
  }
})

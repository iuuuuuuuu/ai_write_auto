import { ZodError } from 'zod'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error: any, { event }) => {
    if (!event) return
    if (error instanceof ZodError) {
      const fieldErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      setResponseStatus(event, 400)
      return send(event, JSON.stringify({
        statusCode: 400,
        message: `参数验证失败: ${fieldErrors}`
      }), 'application/json')
    }
  })
})

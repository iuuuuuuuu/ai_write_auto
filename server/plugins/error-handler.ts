import { ZodError } from 'zod'
import { H3Error } from 'h3'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error: any, { event }) => {
    if (!event) return

    const zodErr = error instanceof ZodError ? error
      : (error instanceof H3Error && error.cause instanceof ZodError) ? error.cause
      : null

    if (zodErr) {
      const fieldErrors = zodErr.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
      if (!event.node.res.headersSent) {
        setResponseStatus(event, 400)
        send(event, JSON.stringify({
          statusCode: 400,
          message: `参数验证失败: ${fieldErrors}`
        }), 'application/json')
      }
    }
  })
})

import { SiteConfigSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const em = event.context.em
  if (!em) {
    return { allowRegistration: false }
  }
  const config = await em.findOne(SiteConfigSchema, { key: 'allow_registration' })
  return {
    allowRegistration: config?.value === 'true'
  }
})

import { SiteConfigSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)

  const instanceConfig = await em.findOne(SiteConfigSchema, { key: 'db_instance_id' })

  return {
    user: {
      id: auth.userId,
      username: auth.username,
      role: auth.role,
    },
    dbInstanceId: instanceConfig?.value || null,
  }
})

import { syncNovelTemplateSeeds } from '../../../services/novel-template-seeds'
import { getOrm } from '../../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  return await syncNovelTemplateSeeds(getOrm())
})

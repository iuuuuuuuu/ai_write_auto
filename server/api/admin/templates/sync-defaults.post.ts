import { syncNovelTemplateSeeds } from '../../../services/novel-template-seeds'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  return await syncNovelTemplateSeeds(getOrm())
})

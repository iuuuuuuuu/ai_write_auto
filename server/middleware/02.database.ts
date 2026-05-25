import { getOrm } from '../database'

export default defineEventHandler((event) => {
  try {
    const orm = getOrm()
    event.context.em = orm.em.fork()
  } catch {
    // ORM not initialized yet (setup flow)
  }
})

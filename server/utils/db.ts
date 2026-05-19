import type { EntityManager } from '@mikro-orm/core'
import type { H3Event } from 'h3'
import { getOrm } from '../database'

export function useEm(event: H3Event): EntityManager {
  const em = event.context.em as EntityManager | undefined
  if (!em) throw new Error('EntityManager not available - ORM not initialized')
  return em
}

export function useFreshEm(): EntityManager {
  return getOrm().em.fork()
}

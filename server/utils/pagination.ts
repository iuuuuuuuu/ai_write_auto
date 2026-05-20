import type { H3Event } from 'h3'

export interface PaginationParams {
  page: number
  pageSize: number
  limit: number
  offset: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function parsePagination(event: H3Event, defaults?: { pageSize?: number }): PaginationParams {
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || defaults?.pageSize || 20))
  const offset = (page - 1) * pageSize

  return { page, pageSize, limit: pageSize, offset }
}

export function paginatedResult<T>(items: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  }
}

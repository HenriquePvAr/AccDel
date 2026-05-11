import type { ListResponse, PaginationMeta, PaginationParams } from '@/contracts'

export function buildPaginationMeta(
  total: number,
  params?: PaginationParams,
): PaginationMeta {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? (total || 1)

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export function buildListResponse<T>(
  rows: T[],
  params?: PaginationParams,
): ListResponse<T> {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? (rows.length || 1)
  const start = (page - 1) * pageSize
  const data = rows.slice(start, start + pageSize)

  return {
    data,
    meta: buildPaginationMeta(rows.length, { page, pageSize }),
  }
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export function normalizePagination(params?: PaginationParams) {
  const page = Math.max(1, Number(params?.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize ?? 100)))
  const skip = (page - 1) * pageSize

  return {
    page,
    pageSize,
    skip,
    take: pageSize,
  }
}

export function buildListResponse<T>(
  data: T[],
  total: number,
  params?: PaginationParams,
) {
  const { page, pageSize } = normalizePagination(params)

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

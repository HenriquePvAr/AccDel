export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListResponse<T> {
  data: T[]
  meta: PaginationMeta
}

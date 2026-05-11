import type { Waiter } from '@/types'

import type { ListResponse } from '@/contracts/common'

export type ListWaitersResponse = ListResponse<Waiter>

export interface GetWaiterByIdRequest {
  waiterId: string
}

export interface GetWaiterByIdResponse {
  data: Waiter
}

export interface SaveWaiterRequest {
  waiter: Omit<Pick<Waiter, 'id' | 'name' | 'email' | 'phone' | 'status'>, 'id'> & {
    id?: string
    active: boolean
  }
}

export interface SaveWaiterResponse {
  data: Waiter
}

export interface UpdateWaiterStatusRequest {
  waiterId: string
  active: boolean
  status?: Waiter['status']
}

export interface UpdateWaiterStatusResponse {
  data: Waiter
}

import type {
  DiningArea,
  DiningTable,
  PaymentMethod,
  TableSession,
  TableStatus,
} from '@/types'

import type { ListResponse } from '@/contracts/common'

export interface GetDiningTablesResponse {
  data: {
    areas: DiningArea[]
    tables: DiningTable[]
    sessions: TableSession[]
  }
}

export interface GetDiningTableByIdRequest {
  tableId: string
}

export interface GetDiningTableByIdResponse {
  data: {
    table: DiningTable
    session: TableSession | null
  }
}

export interface SaveDiningTableRequest {
  table: {
    id?: string
    code: string
    areaId: string
    capacity: number
    status?: TableStatus
    notes?: string
  }
}

export interface SaveDiningTableResponse {
  data: DiningTable
}

export interface UpdateDiningTableStatusRequest {
  tableId: string
  status: TableStatus
}

export interface UpdateDiningTableStatusResponse {
  data: DiningTable
}

export interface OpenTableSessionRequest {
  tableId: string
  guestCount: number
  waiterId?: string
  notes?: string
}

export interface OpenTableSessionResponse {
  data: TableSession
}

export interface AddTableSessionItemRequest {
  sessionId: string
  productId: string
  quantity: number
  notes?: string
  waiterId?: string
}

export interface AddTableSessionItemResponse {
  data: TableSession
}

export interface UpdateTableSessionRequest {
  sessionId: string
  waiterId?: string | null
  guestCount?: number
  notes?: string
  status?: 'open' | 'awaiting_close'
}

export interface UpdateTableSessionResponse {
  data: TableSession
}

export interface CloseTableSessionRequest {
  sessionId: string
  paymentMethod: PaymentMethod
  discount?: number
  serviceFee?: number
  actor?: string
}

export interface CloseTableSessionResponse {
  data: TableSession
}

export interface TransferTableSessionRequest {
  sessionId: string
  targetTableId: string
  actor?: string
}

export interface TransferTableSessionResponse {
  data: TableSession
}

export interface SplitTableSessionRequest {
  sessionId: string
  itemIds: string[]
  paymentMethod: PaymentMethod
  actor?: string
}

export interface SplitTableSessionResponse {
  data: {
    session: TableSession
    splitSession: TableSession
  }
}

export type ListDiningAreasResponse = ListResponse<DiningArea>

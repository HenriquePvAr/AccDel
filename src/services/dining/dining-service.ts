import type {
  AddTableSessionItemRequest,
  AddTableSessionItemResponse,
  CloseTableSessionRequest,
  CloseTableSessionResponse,
  GetDiningTableByIdRequest,
  GetDiningTableByIdResponse,
  GetDiningTablesResponse,
  OpenTableSessionRequest,
  OpenTableSessionResponse,
  SaveDiningTableRequest,
  SaveDiningTableResponse,
  SplitTableSessionRequest,
  SplitTableSessionResponse,
  TransferTableSessionRequest,
  TransferTableSessionResponse,
  UpdateDiningTableStatusRequest,
  UpdateDiningTableStatusResponse,
  UpdateTableSessionRequest,
  UpdateTableSessionResponse,
} from '@/contracts'
import { getDemoDatabase, mutateDemoDatabase } from '@/services/adapters/demo-database'
import { apiClient, shouldUseApi } from '@/services/http/api-client'
import { mockRealtimeBus } from '@/services/realtime/mock-realtime'
import { simulateAsync } from '@/services/utils'

export const diningService = {
  async getDiningTables(): Promise<GetDiningTablesResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetDiningTablesResponse>('/dining/tables')
    }

    const database = getDemoDatabase()
    return simulateAsync({
      data: {
        areas: database.dining.areas,
        tables: database.dining.tables,
        sessions: database.dining.sessions.filter((session) => session.status !== 'closed'),
      },
    })
  },

  async getDiningTableById(
    request: GetDiningTableByIdRequest,
  ): Promise<GetDiningTableByIdResponse> {
    if (shouldUseApi) {
      return apiClient.get<GetDiningTableByIdResponse>(`/dining/tables/${request.tableId}`)
    }

    const database = getDemoDatabase()
    const table = database.dining.tables.find((entry) => entry.id === request.tableId)!
    const session =
      database.dining.sessions.find((entry) => entry.id === table.currentSessionId) ?? null

    return simulateAsync({
      data: {
        table,
        session,
      },
    })
  },

  async saveTable(request: SaveDiningTableRequest): Promise<SaveDiningTableResponse> {
    if (shouldUseApi) {
      if (request.table.id) {
        return apiClient.patch<SaveDiningTableResponse, SaveDiningTableRequest>(
          `/dining/tables/${request.table.id}`,
          request,
        )
      }

      return apiClient.post<SaveDiningTableResponse, SaveDiningTableRequest>(
        '/dining/tables',
        request,
      )
    }

    const nextDb = mutateDemoDatabase((database) => {
      const existingIndex = database.dining.tables.findIndex(
        (entry) => entry.id === request.table.id,
      )
      const nextTable = {
        id: request.table.id ?? crypto.randomUUID(),
        code: request.table.code,
        areaId: request.table.areaId,
        capacity: request.table.capacity,
        status: request.table.status ?? 'free',
        notes: request.table.notes,
      }

      if (existingIndex >= 0) {
        database.dining.tables[existingIndex] = {
          ...database.dining.tables[existingIndex],
          ...nextTable,
        }
      } else {
        database.dining.tables.unshift(nextTable)
      }

      return database
    })

    const saved =
      nextDb.dining.tables.find((entry) => entry.id === request.table.id) ?? nextDb.dining.tables[0]
    return simulateAsync({ data: saved })
  },

  async updateTableStatus(
    request: UpdateDiningTableStatusRequest,
  ): Promise<UpdateDiningTableStatusResponse> {
    if (shouldUseApi) {
      return apiClient.patch<
        UpdateDiningTableStatusResponse,
        Pick<UpdateDiningTableStatusRequest, 'status'>
      >(`/dining/tables/${request.tableId}/status`, {
        status: request.status,
      })
    }

    const nextDb = mutateDemoDatabase((database) => {
      database.dining.tables = database.dining.tables.map((table) =>
        table.id === request.tableId ? { ...table, status: request.status } : table,
      )
      return database
    })

    return simulateAsync({
      data: nextDb.dining.tables.find((table) => table.id === request.tableId)!,
    })
  },

  async openTableSession(request: OpenTableSessionRequest): Promise<OpenTableSessionResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<
        OpenTableSessionResponse,
        Omit<OpenTableSessionRequest, 'tableId'>
      >(`/dining/tables/${request.tableId}/open-session`, {
        guestCount: request.guestCount,
        waiterId: request.waiterId,
        notes: request.notes,
      })
      mockRealtimeBus.emit('dining.session_updated', {
        sessionId: response.data.id,
        tableId: request.tableId,
      })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      const table = database.dining.tables.find((entry) => entry.id === request.tableId)
      if (!table) {
        return database
      }

      const session = {
        id: crypto.randomUUID(),
        tableId: request.tableId,
        tableCode: table.code,
        waiterId: request.waiterId,
        waiterName: undefined,
        openedAt: new Date().toISOString(),
        guestCount: request.guestCount,
        subtotal: 0,
        discount: 0,
        serviceFee: 0,
        total: 0,
        status: 'open' as const,
        notes: request.notes,
        items: [],
        timeline: [
          {
            id: crypto.randomUUID(),
            label: `Mesa ${table.code} aberta`,
            actor: 'Operacao',
            at: new Date().toISOString(),
          },
        ],
      }

      database.dining.sessions.unshift(session)
      table.currentSessionId = session.id
      table.status = 'occupied'
      table.guests = request.guestCount
      table.waiterId = request.waiterId
      return database
    })

    const saved = nextDb.dining.sessions[0]
    mockRealtimeBus.emit('dining.session_updated', {
      sessionId: saved.id,
      tableId: request.tableId,
    })
    return simulateAsync({ data: saved })
  },

  async addSessionItem(
    request: AddTableSessionItemRequest,
  ): Promise<AddTableSessionItemResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<
        AddTableSessionItemResponse,
        Omit<AddTableSessionItemRequest, 'sessionId'>
      >(`/dining/sessions/${request.sessionId}/add-item`, {
        productId: request.productId,
        quantity: request.quantity,
        notes: request.notes,
        waiterId: request.waiterId,
      })
      mockRealtimeBus.emit('dining.session_updated', {
        sessionId: response.data.id,
        tableId: response.data.tableId,
      })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      const session = database.dining.sessions.find((entry) => entry.id === request.sessionId)
      const product = database.catalog.products.find((entry) => entry.id === request.productId)
      if (!session || !product) {
        return database
      }

      const totalPrice = product.price * request.quantity
      session.items.push({
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        quantity: request.quantity,
        unitPrice: product.price,
        totalPrice,
        notes: request.notes,
      })
      session.subtotal += totalPrice
      session.total += totalPrice
      session.status = 'open'
      session.timeline.push({
        id: crypto.randomUUID(),
        label: `${request.quantity}x ${product.name} lancado(s)`,
        actor: 'Operacao',
        at: new Date().toISOString(),
      })
      const table = database.dining.tables.find((entry) => entry.id === session.tableId)
      if (table) {
        table.status = 'occupied'
      }
      return database
    })

    const updated = nextDb.dining.sessions.find((entry) => entry.id === request.sessionId)!
    mockRealtimeBus.emit('dining.session_updated', {
      sessionId: updated.id,
      tableId: updated.tableId,
    })
    return simulateAsync({ data: updated })
  },

  async updateSession(request: UpdateTableSessionRequest): Promise<UpdateTableSessionResponse> {
    if (shouldUseApi) {
      const response = await apiClient.patch<
        UpdateTableSessionResponse,
        Omit<UpdateTableSessionRequest, 'sessionId'>
      >(`/dining/sessions/${request.sessionId}`, {
        waiterId: request.waiterId,
        guestCount: request.guestCount,
        notes: request.notes,
        status: request.status,
      })
      mockRealtimeBus.emit('dining.session_updated', {
        sessionId: response.data.id,
        tableId: response.data.tableId,
      })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      const session = database.dining.sessions.find((entry) => entry.id === request.sessionId)
      if (!session) {
        return database
      }

      session.waiterId = request.waiterId === undefined ? session.waiterId : request.waiterId ?? undefined
      session.guestCount = request.guestCount ?? session.guestCount
      session.notes = request.notes ?? session.notes
      session.status = request.status ?? session.status
      session.timeline.push({
        id: crypto.randomUUID(),
        label: 'Sessao atualizada',
        actor: 'Operacao',
        at: new Date().toISOString(),
      })
      const table = database.dining.tables.find((entry) => entry.id === session.tableId)
      if (table) {
        table.guests = session.guestCount
        table.waiterId = session.waiterId
        table.status = session.status === 'awaiting_close' ? 'closing' : 'occupied'
      }
      return database
    })

    return simulateAsync({
      data: nextDb.dining.sessions.find((entry) => entry.id === request.sessionId)!,
    })
  },

  async closeSession(request: CloseTableSessionRequest): Promise<CloseTableSessionResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<
        CloseTableSessionResponse,
        Omit<CloseTableSessionRequest, 'sessionId'>
      >(`/dining/sessions/${request.sessionId}/close`, {
        paymentMethod: request.paymentMethod,
        discount: request.discount,
        serviceFee: request.serviceFee,
        actor: request.actor,
      })
      mockRealtimeBus.emit('dining.session_updated', {
        sessionId: response.data.id,
        tableId: response.data.tableId,
      })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      const session = database.dining.sessions.find((entry) => entry.id === request.sessionId)
      if (!session) {
        return database
      }

      session.discount = request.discount ?? session.discount
      session.serviceFee = request.serviceFee ?? session.serviceFee
      session.total = Math.max(0, session.subtotal - session.discount + session.serviceFee)
      session.paymentMethod = request.paymentMethod
      session.status = 'closed'
      session.closedAt = new Date().toISOString()
      session.timeline.push({
        id: crypto.randomUUID(),
        label: 'Conta fechada',
        actor: request.actor ?? 'Caixa',
        at: new Date().toISOString(),
      })

      const table = database.dining.tables.find((entry) => entry.id === session.tableId)
      if (table) {
        table.currentSessionId = undefined
        table.status = 'closed'
        table.guests = undefined
        table.waiterId = undefined
      }

      return database
    })

    return simulateAsync({
      data: nextDb.dining.sessions.find((entry) => entry.id === request.sessionId)!,
    })
  },

  async transferSession(
    request: TransferTableSessionRequest,
  ): Promise<TransferTableSessionResponse> {
    if (shouldUseApi) {
      const response = await apiClient.post<
        TransferTableSessionResponse,
        Omit<TransferTableSessionRequest, 'sessionId'>
      >(`/dining/sessions/${request.sessionId}/transfer`, {
        targetTableId: request.targetTableId,
        actor: request.actor,
      })
      mockRealtimeBus.emit('dining.session_updated', {
        sessionId: response.data.id,
        tableId: response.data.tableId,
      })
      return response
    }

    const nextDb = mutateDemoDatabase((database) => {
      const session = database.dining.sessions.find((entry) => entry.id === request.sessionId)
      const target = database.dining.tables.find((entry) => entry.id === request.targetTableId)
      if (!session || !target) {
        return database
      }

      const source = database.dining.tables.find((entry) => entry.id === session.tableId)
      if (source) {
        source.currentSessionId = undefined
        source.status = 'free'
        source.guests = undefined
        source.waiterId = undefined
      }

      session.tableId = target.id
      session.tableCode = target.code
      session.timeline.push({
        id: crypto.randomUUID(),
        label: `Conta transferida para mesa ${target.code}`,
        actor: request.actor ?? 'Operacao',
        at: new Date().toISOString(),
      })

      target.currentSessionId = session.id
      target.status = session.status === 'awaiting_close' ? 'closing' : 'occupied'
      target.guests = session.guestCount
      target.waiterId = session.waiterId

      return database
    })

    return simulateAsync({
      data: nextDb.dining.sessions.find((entry) => entry.id === request.sessionId)!,
    })
  },

  async splitSession(request: SplitTableSessionRequest): Promise<SplitTableSessionResponse> {
    if (shouldUseApi) {
      return apiClient.post<SplitTableSessionResponse, Omit<SplitTableSessionRequest, 'sessionId'>>(
        `/dining/sessions/${request.sessionId}/split`,
        {
          itemIds: request.itemIds,
          paymentMethod: request.paymentMethod,
          actor: request.actor,
        },
      )
    }

    return simulateAsync({
      data: {
        session: getDemoDatabase().dining.sessions.find((entry) => entry.id === request.sessionId)!,
        splitSession: getDemoDatabase().dining.sessions.find((entry) => entry.id === request.sessionId)!,
      },
    })
  },
}

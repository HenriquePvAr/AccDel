import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRightLeft, Plus, ReceiptText, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { CurrentOrderDrawer } from '@/components/CurrentOrderDrawer'
import { OrderItemRow } from '@/components/OrderItemRow'
import { ProductCatalog } from '@/components/ProductCatalog'
import { QuantityStepper } from '@/components/QuantityStepper'
import { ErrorState, LoadingState, OfflineActionNotice } from '@/components/States'
import { TableStatusBadge } from '@/components/StatusBadge'
import { Toast, type ToastMessage } from '@/components/Toast'
import { ApiError, apiRequest, createIdempotencyKey } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { clearDraft, draftKey, loadDraft, saveDraft } from '@/lib/drafts'
import { currency, elapsedTime } from '@/lib/format'
import { trackMetric } from '@/lib/metrics'
import { useOnlineStatus } from '@/lib/online'
import { useWaiterRealtime } from '@/lib/realtime'
import type { DraftItem, RoomSnapshot, TableDetail, TableSession, WaiterMenu } from '@/types'

type ActionKind = 'close' | 'transfer' | null

export function TableSessionPage() {
  const { tableId = '' } = useParams()
  const { user } = useAuth()
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [action, setAction] = useState<ActionKind>(null)
  const [cancelItemId, setCancelItemId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [targetTableId, setTargetTableId] = useState('')
  const [conflict, setConflict] = useState('')
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const storageKey = user ? draftKey(user.store.id, user.id, tableId) : ''
  const [draft, setDraft] = useState<DraftItem[]>(() => storageKey ? loadDraft(storageKey) : [])

  const tableQuery = useQuery({
    queryKey: ['waiter', 'table', tableId],
    queryFn: () => apiRequest<{ data: TableDetail }>(`/waiter/tables/${tableId}`),
    enabled: Boolean(tableId),
    refetchInterval: 45_000,
  })
  const menuQuery = useQuery({
    queryKey: ['waiter', 'menu'],
    queryFn: () => apiRequest<{ data: WaiterMenu }>('/waiter/menu'),
    staleTime: 5 * 60_000,
  })
  const roomQuery = useQuery({
    queryKey: ['waiter', 'tables'],
    queryFn: () => apiRequest<{ data: RoomSnapshot }>('/waiter/tables'),
    enabled: action === 'transfer',
  })

  useWaiterRealtime(() => {
    void tableQuery.refetch()
    void queryClient.invalidateQueries({ queryKey: ['waiter', 'tables'] })
  })

  useEffect(() => {
    if (storageKey) saveDraft(storageKey, draft)
  }, [draft, storageKey])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3_500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const refresh = async () => {
    await Promise.all([tableQuery.refetch(), menuQuery.refetch()])
    setConflict('')
  }

  const openMutation = useMutation({
    mutationFn: (guestCount: number) => apiRequest<{ data: TableSession }>(`/waiter/tables/${tableId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ guestCount, expectedTableVersion: tableQuery.data!.data.table.version }),
      idempotencyKey: createIdempotencyKey('open'),
    }),
    onSuccess: async () => {
      trackMetric('session_opened')
      setToast({ tone: 'success', text: 'Mesa aberta. Você já pode adicionar produtos.' })
      await tableQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ['waiter', 'tables'] })
    },
    onError: handleMutationError,
  })

  const sendMutation = useMutation({
    mutationFn: () => apiRequest<{ data: TableSession }>(`/waiter/sessions/${session!.id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        expectedVersion: session!.version,
        items: draft.map((item) => ({ productId: item.productId, quantity: item.quantity, notes: item.notes, options: item.options })),
      }),
      idempotencyKey: createIdempotencyKey('send'),
    }),
    onSuccess: async () => {
      trackMetric('items_sent')
      if (storageKey) clearDraft(storageKey)
      setDraft([])
      setDrawerOpen(false)
      setToast({ tone: 'success', text: 'Itens confirmados e enviados para produção.' })
      await tableQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ['waiter', 'tables'] })
    },
    onError: handleMutationError,
  })

  const closeMutation = useMutation({
    mutationFn: () => apiRequest(`/waiter/sessions/${session!.id}/request-close`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: session!.version }),
      idempotencyKey: createIdempotencyKey('close'),
    }),
    onSuccess: async () => {
      trackMetric('close_requested')
      setAction(null)
      setToast({ tone: 'success', text: 'Fechamento solicitado ao caixa.' })
      await tableQuery.refetch()
    },
    onError: handleMutationError,
  })

  const transferMutation = useMutation({
    mutationFn: () => {
      const target = roomQuery.data?.data.tables.find((table) => table.id === targetTableId)
      if (!target) throw new Error('Selecione uma mesa livre.')
      return apiRequest(`/waiter/sessions/${session!.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: session!.version, targetTableId, expectedTargetTableVersion: target.version }),
        idempotencyKey: createIdempotencyKey('transfer'),
      })
    },
    onSuccess: () => {
      trackMetric('session_transferred')
      setAction(null)
      navigate(`/mesas/${targetTableId}`, { replace: true })
      void queryClient.invalidateQueries({ queryKey: ['waiter', 'tables'] })
    },
    onError: handleMutationError,
  })

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest(`/waiter/sessions/${session!.id}/items/${cancelItemId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: session!.version, reason: cancelReason }),
      idempotencyKey: createIdempotencyKey('cancel'),
    }),
    onSuccess: async () => {
      trackMetric('item_cancelled')
      setCancelItemId(null)
      setCancelReason('')
      setToast({ tone: 'success', text: 'Cancelamento registrado e comunicado à produção.' })
      await tableQuery.refetch()
    },
    onError: handleMutationError,
  })

  const deliverMutation = useMutation({
    mutationFn: (itemId: string) => apiRequest(`/waiter/sessions/${session!.id}/items/${itemId}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: session!.version }),
      idempotencyKey: createIdempotencyKey('deliver'),
    }),
    onSuccess: async () => {
      trackMetric('item_delivered')
      setToast({ tone: 'success', text: 'Item marcado como entregue à mesa.' })
      await tableQuery.refetch()
    },
    onError: handleMutationError,
  })

  function handleMutationError(cause: Error) {
    if (cause instanceof ApiError && cause.status === 409) {
      setConflict('Esta comanda foi atualizada em outro dispositivo. Revise as alterações antes de continuar.')
      void tableQuery.refetch()
      return
    }
    setToast({ tone: 'error', text: cause.message })
  }

  const session = tableQuery.data?.data.session ?? null
  const table = tableQuery.data?.data.table
  const grouped = useMemo(() => groupItems(session), [session])

  if (tableQuery.isPending) return <LoadingState label="Carregando comanda…" />
  if (tableQuery.isError) return <ErrorState message={tableQuery.error.message} onRetry={() => void tableQuery.refetch()} />
  if (!table) return <ErrorState message="Mesa não encontrada." />

  return (
    <section className="page session-page">
      <header className="session-header">
        <Link className="icon-button" to="/" aria-label="Voltar para mesas"><ArrowLeft /></Link>
        <div><span className="eyebrow">Mesa</span><h1>{table.code}</h1></div>
        <div className="session-header-status"><ConnectionStatus /><TableStatusBadge status={table.status} /></div>
      </header>

      {conflict && <div className="operational-alert conflict" role="alert"><strong>Comanda atualizada</strong><p>{conflict}</p><button className="button secondary" type="button" onClick={() => void refresh()}>Revisar agora</button></div>}
      {!online && <OfflineActionNotice />}

      {!session ? (
        <OpenTablePanel tableCode={table.code} capacity={table.capacity} online={online} busy={openMutation.isPending} onOpen={(count) => openMutation.mutate(count)} />
      ) : (
        <>
          <div className="session-summary">
            <span><Users size={18} /> <strong>{session.guestCount}</strong> pessoas</span>
            <span>Ocupada há <strong>{elapsedTime(session.openedAt)}</strong></span>
            <span>Responsável <strong>{session.waiterName ?? 'Gerência'}</strong></span>
            <span className="session-total">Resumo <strong>{currency.format(session.total)}</strong></span>
          </div>

          {session.status === 'closed' ? (
            <div className="operational-alert"><strong>Sessão encerrada</strong><p>Esta conta já foi fechada pelo caixa e não aceita novas alterações.</p></div>
          ) : (
            <div className="session-actions">
              <button className="button primary" type="button" disabled={!online || session.status === 'awaiting_close'} onClick={() => setCatalogOpen(true)}><Plus size={19} /> Adicionar produtos</button>
              <button className="button secondary" type="button" disabled={!online} onClick={() => setAction('transfer')}><ArrowRightLeft size={18} /> Transferir</button>
              <button className="button secondary" type="button" disabled={!online || draft.length > 0 || session.status === 'awaiting_close'} onClick={() => setAction('close')}><ReceiptText size={18} /> Solicitar fechamento</button>
            </div>
          )}

          {session.status === 'awaiting_close' && <div className="operational-alert success"><strong>Fechamento solicitado</strong><p>O caixa recebeu a solicitação. O pagamento continua sob responsabilidade financeira.</p></div>}

          <div className="command-sections">
            <OrderSection title="Prontos para levar" description="Prioridade de entrega" items={grouped.ready} empty="Nenhum item pronto agora." render={(item) => <OrderItemRow key={item.id} item={item} onDeliver={online ? () => deliverMutation.mutate(item.id) : undefined} onCancel={online ? () => setCancelItemId(item.id) : undefined} />} />
            <OrderSection title="Em produção" description="Recebidos pela cozinha" items={grouped.production} empty="Nenhum item em produção." render={(item) => <OrderItemRow key={item.id} item={item} onCancel={online ? () => setCancelItemId(item.id) : undefined} />} />
            <OrderSection title="Entregues à mesa" items={grouped.delivered} empty="As entregas aparecerão aqui." render={(item) => <OrderItemRow key={item.id} item={item} />} />
            <OrderSection title="Cancelados" items={grouped.cancelled} empty="Nenhum item cancelado." render={(item) => <OrderItemRow key={item.id} item={item} />} />
          </div>
        </>
      )}

      {catalogOpen && menuQuery.data && <ProductCatalog menu={menuQuery.data.data} onClose={() => setCatalogOpen(false)} onAdd={(item) => { setDraft((current) => [...current, item]); setToast({ tone: 'success', text: `${item.name} adicionado ao rascunho.` }) }} />}
      {catalogOpen && menuQuery.isPending && <div className="catalog-overlay"><LoadingState label="Carregando cardápio…" /></div>}
      {catalogOpen && menuQuery.isError && <div className="catalog-overlay"><ErrorState message={menuQuery.error.message} onRetry={() => void menuQuery.refetch()} /><button className="button ghost catalog-error-close" type="button" onClick={() => setCatalogOpen(false)}>Voltar à comanda</button></div>}
      {session && <CurrentOrderDrawer items={draft} open={drawerOpen} sending={sendMutation.isPending} online={online} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)} onQuantity={(clientId, quantity) => setDraft((current) => current.map((item) => item.clientId === clientId ? { ...item, quantity } : item))} onRemove={(clientId) => setDraft((current) => current.filter((item) => item.clientId !== clientId))} onSend={() => sendMutation.mutate()} />}

      <ConfirmDialog open={action === 'close'} title="Solicitar fechamento?" description={<p>Revise a comanda antes. O caixa será avisado, mas nenhum pagamento será confirmado por aqui.</p>} confirmLabel="Solicitar ao caixa" busy={closeMutation.isPending} onClose={() => setAction(null)} onConfirm={() => closeMutation.mutate()} />
      <ConfirmDialog open={action === 'transfer'} title="Transferir comanda" description={<label className="dialog-field"><span>Mesa de destino</span><select value={targetTableId} onChange={(event) => setTargetTableId(event.target.value)}><option value="">Selecione uma mesa livre</option>{roomQuery.data?.data.tables.filter((entry) => entry.status === 'free' && !entry.currentSessionId).map((entry) => <option key={entry.id} value={entry.id}>Mesa {entry.code} · {entry.areaName}</option>)}</select></label>} confirmLabel="Confirmar transferência" busy={transferMutation.isPending} onClose={() => setAction(null)} onConfirm={() => transferMutation.mutate()} />
      <ConfirmDialog open={Boolean(cancelItemId)} destructive title="Cancelar item enviado?" description={<label className="dialog-field"><span>Motivo obrigatório</span><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={180} placeholder="Ex.: cliente desistiu" /></label>} confirmLabel="Registrar cancelamento" busy={cancelMutation.isPending} onClose={() => { setCancelItemId(null); setCancelReason('') }} onConfirm={() => { if (cancelReason.trim().length >= 3) cancelMutation.mutate() }} />
      <Toast message={toast} />
    </section>
  )
}

function OpenTablePanel({ tableCode, capacity, online, busy, onOpen }: { tableCode: string; capacity: number; online: boolean; busy: boolean; onOpen(count: number): void }) {
  const [count, setCount] = useState(Math.min(2, capacity))
  return <div className="open-table-panel"><div className="open-table-icon"><Users size={30} /></div><span className="eyebrow">Mesa disponível</span><h2>Abrir mesa {tableCode}</h2><p>Informe apenas quantas pessoas serão atendidas.</p><QuantityStepper value={count} max={20} label="Quantidade de pessoas" onChange={setCount} /><button className="button primary" type="button" disabled={!online || busy} onClick={() => onOpen(count)}>{busy ? 'Abrindo…' : `Abrir para ${count} pessoa${count > 1 ? 's' : ''}`}</button></div>
}

function OrderSection({ title, description, items, empty, render }: { title: string; description?: string; items: NonNullable<TableSession>['items']; empty: string; render(item: NonNullable<TableSession>['items'][number]): ReactNode }) {
  return <section className={`order-section ${title.startsWith('Prontos') && items.length ? 'ready-section' : ''}`}><header><div><h2>{title}</h2>{description && <p>{description}</p>}</div><span>{items.length}</span></header>{items.length ? <div>{items.map(render)}</div> : <p className="section-empty">{empty}</p>}</section>
}

function groupItems(session: TableSession | null) {
  const items = session?.items ?? []
  return {
    production: items.filter((item) => !item.cancelledAt && !item.deliveredAt && item.productionStatus !== 'ready'),
    ready: items.filter((item) => !item.cancelledAt && !item.deliveredAt && item.productionStatus === 'ready'),
    delivered: items.filter((item) => Boolean(item.deliveredAt)),
    cancelled: items.filter((item) => Boolean(item.cancelledAt)),
  }
}

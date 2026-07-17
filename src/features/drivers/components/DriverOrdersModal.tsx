import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  GripVertical,
  Package2,
  RotateCcw,
  Route,
  Sparkles,
  Truck,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type {
  DriverDispatchCandidate,
  DriverRoutePreviewResponse,
} from '@/contracts'
import { formatCompactCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DeliveryStop, Driver, DriverRoute } from '@/types'

import { DriverStatusPill } from './DriverStatusPill'
import {
  formatDistanceMeters,
  formatEtaMinutes,
  getSecondaryStop,
} from './driver-location-utils'

interface DriverOrdersModalProps {
  open: boolean
  driver: Driver | null
  route: DriverRoute | null
  candidates: DriverDispatchCandidate[]
  preview: DriverRoutePreviewResponse['data'] | null
  draftOrderIds: string[]
  loading?: boolean
  previewLoading?: boolean
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onAssign: (orderId: string) => void
  onPreviewCandidate: (candidate: DriverDispatchCandidate) => void
  onClearPreview: () => void
  onDraftOrderIdsChange: (orderIds: string[]) => void
  onSaveDraftRoute: () => void
}

export function DriverOrdersModal({
  open,
  driver,
  route,
  candidates,
  preview,
  draftOrderIds,
  loading = false,
  previewLoading = false,
  busy = false,
  onOpenChange,
  onAssign,
  onPreviewCandidate,
  onClearPreview,
  onDraftOrderIdsChange,
  onSaveDraftRoute,
}: DriverOrdersModalProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const assignedStops = route?.stops ?? driver?.queue ?? []
  const assignedStopsByOrderId = useMemo(
    () => new Map(assignedStops.map((stop) => [stop.orderId, stop])),
    [assignedStops],
  )
  const orderedAssignedStops = useMemo(() => {
    if (!draftOrderIds.length) {
      return assignedStops
    }

    return draftOrderIds
      .map((orderId) => assignedStopsByOrderId.get(orderId))
      .filter((stop): stop is DeliveryStop => Boolean(stop))
  }, [assignedStops, assignedStopsByOrderId, draftOrderIds])
  const nextStop = driver ? getSecondaryStop(driver, route) : null
  const dispatchDisabled = !driver || !(driver.active ?? true) || driver.availability === 'paused'
  const routeOrderIds = assignedStops.map((stop) => stop.orderId)
  const routeDraftDirty =
    routeOrderIds.length > 0 &&
    (routeOrderIds.length !== draftOrderIds.length ||
      routeOrderIds.some((orderId, index) => orderId !== draftOrderIds[index]))

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null

    if (!overId || activeId === overId) {
      return
    }

    const currentIds = draftOrderIds.length ? draftOrderIds : routeOrderIds
    const activeIndex = currentIds.indexOf(activeId)
    const overIndex = currentIds.indexOf(overId)

    if (activeIndex < 0 || overIndex < 0) {
      return
    }

    onDraftOrderIdsChange(arrayMove(currentIds, activeIndex, overIndex))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[1240px] overflow-hidden p-0">
        <div className="border-b border-white/10 px-6 py-5">
          <DialogHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl font-black tracking-[-0.03em] text-white">
                  {driver ? `Central de despacho | ${driver.name}` : 'Central de despacho'}
                </DialogTitle>
                <DialogDescription className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                  Despache pedidos prontos, reorganize a rota ativa e visualize o impacto logistico antes de confirmar.
                </DialogDescription>
              </div>
              {driver ? <DriverStatusPill driver={driver} /> : null}
            </div>

            {driver ? (
              <div className="grid gap-3 md:grid-cols-4">
                <MetricTile label="Em rota" value={`${driver.queue.length}`} hint="pedidos com o motoboy" />
                <MetricTile
                  label="ETA total"
                  value={route ? formatEtaMinutes(route.etaMinutes) : '--'}
                  hint="duração"
                />
                <MetricTile
                  label="Distancia"
                  value={route ? formatDistanceMeters(route.distanceMeters) : '--'}
                  hint="rota restante"
                />
                <MetricTile
                  label="Proxima parada"
                  value={nextStop?.orderNumber ?? '--'}
                  hint={nextStop?.customerName ?? 'sem entrega futura'}
                />
              </div>
            ) : null}

            {preview ? (
              <PreviewImpactCard
                preview={preview}
                busy={busy}
                routeDraftDirty={routeDraftDirty}
                onClearPreview={onClearPreview}
                onSaveDraftRoute={onSaveDraftRoute}
              />
            ) : null}
          </DialogHeader>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <section className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-sky-300" />
                <h3 className="text-base font-black text-white">Pedidos ja atribuidos</h3>
              </div>
              {routeDraftDirty ? (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  nova ordem
                </span>
              ) : null}
            </div>

            {orderedAssignedStops.length ? (
              <ScrollArea className="max-h-[56vh] pr-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={orderedAssignedStops.map((stop) => stop.orderId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {orderedAssignedStops.map((stop, index) => (
                        <SortableAssignedStopCard
                          key={stop.orderId}
                          stop={stop}
                          index={index}
                          active={index === 0}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </ScrollArea>
            ) : (
              <EmptyState
                icon={<Truck className="h-5 w-5" />}
                title="Nenhuma rota ativa"
                description="Este motoboy ainda nao tem pedidos atribuidos em rota."
              />
            )}
          </section>

          <section className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Package2 className="h-4 w-4 text-primary" />
                <h3 className="text-base font-black text-white">Pedidos prontos aguardando atribuicao</h3>
              </div>
              {previewLoading ? (
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-200">
                  pre-visualizando rota
                </span>
              ) : null}
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.035]"
                  />
                ))}
              </div>
            ) : candidates.length ? (
              <ScrollArea className="max-h-[56vh] pr-2">
                <div className="space-y-3">
                  {candidates[0]?.suggested ? (
                    <div className="rounded-[22px] border border-primary/20 bg-primary/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/24 bg-primary/12 text-primary">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">Melhor sugestão</p>
                          <p className="mt-1 text-sm text-slate-300">
                            {candidates[0].orderNumber} | {candidates[0].customerName}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {candidates[0].suggestionLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {candidates.map((candidate) => {
                    const selectedPreview = preview?.previewOrderId === candidate.orderId
                    return (
                      <div
                        key={candidate.orderId}
                        className={cn(
                          'rounded-[22px] border p-4 transition',
                          selectedPreview
                            ? 'border-primary/26 bg-primary/10 shadow-[0_20px_48px_rgba(234,109,44,0.12)]'
                            : 'border-white/10 bg-white/[0.035]',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-white">
                                {candidate.orderNumber} | {candidate.customerName}
                              </p>
                              <StatusBadge channel={candidate.source} />
                              <PriorityPill priority={candidate.priority} />
                            </div>
                            <p className="mt-2 text-sm text-slate-400">
                              {candidate.addressText ?? candidate.addressLabel}
                            </p>
                          </div>
                          <p className="shrink-0 text-base font-black text-white">
                            {formatCompactCurrency(candidate.total)}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-4">
                          <CandidateMetric
                            icon={<Clock3 className="h-4 w-4" />}
                            label="ETA da loja"
                            value={formatEtaMinutes(candidate.etaFromStoreMinutes)}
                          />
                          <CandidateMetric
                            icon={<Route className="h-4 w-4" />}
                            label="Distancia"
                            value={formatDistanceMeters(candidate.distanceFromStoreMeters)}
                          />
                          <CandidateMetric
                            icon={<Sparkles className="h-4 w-4" />}
                            label="Impacto"
                            value={`+${candidate.addedEtaMinutes} min`}
                          />
                          <CandidateMetric
                            icon={<Package2 className="h-4 w-4" />}
                            label="Encaixe"
                            value={`${candidate.bestInsertionSequence}a parada`}
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-slate-400">{candidate.suggestionLabel}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onPreviewCandidate(candidate)}
                            >
                              Prever rota
                            </Button>
                            <Button asChild variant="ghost" size="sm">
                              <Link to={`/orders/${candidate.orderId}`}>
                                Ver pedido
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              disabled={busy || dispatchDisabled}
                              onClick={() => onAssign(candidate.orderId)}
                            >
                              Atribuir ao motoboy
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            ) : (
              <EmptyState
                icon={<Package2 className="h-5 w-5" />}
                title="Nenhum pedido pronto disponivel"
                description="Todos os pedidos prontos já saíram para entrega ou ainda estão em preparo."
              />
            )}

            {dispatchDisabled ? (
              <div className="mt-4 rounded-[20px] border border-amber-400/18 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Este entregador está pausado ou inativo. Reative o status antes de atribuir novos pedidos.
              </div>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PreviewImpactCard({
  preview,
  busy,
  routeDraftDirty,
  onClearPreview,
  onSaveDraftRoute,
}: {
  preview: DriverRoutePreviewResponse['data']
  busy: boolean
  routeDraftDirty: boolean
  onClearPreview: () => void
  onSaveDraftRoute: () => void
}) {
  const tone =
    preview.severity === 'low'
      ? 'border-emerald-400/20 bg-emerald-400/10'
      : preview.severity === 'medium'
        ? 'border-amber-400/20 bg-amber-400/10'
        : 'border-rose-400/20 bg-rose-400/10'

  const orderSequence = preview.previewRoute.stops.map((stop) => stop.orderNumber).join(' → ')

  return (
    <div className={cn('rounded-[24px] border p-4', tone)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            {preview.severity === 'high' ? (
              <AlertTriangle className="h-4 w-4 text-rose-200" />
            ) : (
              <Sparkles className="h-4 w-4 text-white" />
            )}
            Prévia da rota
          </div>
          <p className="text-sm text-slate-200">{preview.recommendation}</p>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/90">{orderSequence}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <MetricTile label="ETA extra" value={`+${preview.addedEtaMinutes} min`} hint="impacto na rota" />
          <MetricTile
            label="Distancia extra"
            value={formatDistanceMeters(preview.addedDistanceMeters)}
            hint="trecho adicional"
          />
          <MetricTile
            label="Score logistico"
            value={`${preview.routeCompatibilityScore}/100`}
            hint="melhor encaixe"
          />
          <MetricTile
            label="Nova ordem"
            value={`${preview.previewRoute.stops.length} paradas`}
            hint={preview.insertedSequence ? `${preview.insertedSequence}a posicao` : 'reordenacao'}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClearPreview}>
          <RotateCcw className="h-4 w-4" />
          Limpar preview
        </Button>
        {routeDraftDirty ? (
          <Button type="button" size="sm" disabled={busy} onClick={onSaveDraftRoute}>
            Salvar nova ordem
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

function CandidateMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function SortableAssignedStopCard({
  stop,
  index,
  active,
}: {
  stop: DeliveryStop
  index: number
  active: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.orderId })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'rounded-[22px] border bg-white/[0.035] p-4',
        active ? 'border-sky-400/24' : 'border-white/10',
        isDragging && 'shadow-[0_24px_64px_rgba(0,0,0,0.28)]',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-white">
              {index + 1}. {stop.orderNumber} | {stop.customerName}
            </p>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]',
                active
                  ? 'bg-sky-400/12 text-sky-200 ring-1 ring-sky-300/25'
                  : 'bg-white/[0.05] text-slate-400 ring-1 ring-white/10',
              )}
            >
              {active ? 'Parada atual' : 'Proxima parada'}
            </span>
            {stop.status ? <StatusBadge status={stop.status} /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">{stop.addressLabel}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>{formatEtaMinutes(stop.etaMinutes)}</span>
            <span>{formatDistanceMeters(stop.distanceMeters)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PriorityPill({ priority }: { priority: DriverDispatchCandidate['priority'] }) {
  const className =
    priority === 'vip'
      ? 'border-fuchsia-400/25 bg-fuchsia-400/12 text-fuchsia-200'
      : priority === 'priority'
        ? 'border-amber-400/25 bg-amber-400/12 text-amber-200'
        : 'border-white/10 bg-white/[0.05] text-slate-300'

  const label =
    priority === 'vip' ? 'VIP' : priority === 'priority' ? 'Prioridade' : 'Normal'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${className}`}
    >
      {label}
    </span>
  )
}

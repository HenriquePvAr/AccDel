import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Clock3,
  MapPinned,
  MoveRight,
  Package2,
  Phone,
  Route,
  Scooter,
  TimerReset,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DriverRoutePreviewResponse } from '@/contracts'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { formatCompactCurrency, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order, Driver, DriverLocation, DriverRoute } from '@/types'

import { DriverStatusPill } from './DriverStatusPill'
import {
  driverMapStoreLabel,
  formatDistanceMeters,
  formatEtaMinutes,
  formatSpeedKmh,
  getPrimaryStop,
  getSecondaryStop,
} from './driver-location-utils'

interface DeliveryDetailsPanelProps {
  driver: Driver | null
  location: DriverLocation | null
  route: DriverRoute | null
  previewRoute?: DriverRoutePreviewResponse['data'] | null
  order: Order | null
  routeLoading?: boolean
  realtimeConnected?: boolean
  devControls?: ReactNode
  onOpenDispatchCenter?: () => void
}

export function DeliveryDetailsPanel({
  driver,
  location,
  route,
  previewRoute = null,
  order,
  routeLoading = false,
  realtimeConnected = false,
  devControls,
  onOpenDispatchCenter,
}: DeliveryDetailsPanelProps) {
  if (!driver) {
    return (
      <Card className="h-fit p-5 xl:sticky xl:top-5">
        <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.05] text-primary">
            <Scooter className="h-6 w-6" />
          </div>
          <p className="text-lg font-black text-white">Selecione um motoboy</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Escolha um entregador na lista para ver rota, ETA, parada atual e status da entrega.
          </p>
        </div>
      </Card>
    )
  }

  const currentStop = getPrimaryStop(driver, route)
  const nextStop = getSecondaryStop(driver, route)
  const destinationLabel = order?.addressText ?? currentStop?.addressLabel ?? 'Sem destino ativo'
  const routeDistance = currentStop?.distanceMeters ?? route?.distanceMeters ?? null
  const routeEta = currentStop?.etaMinutes ?? route?.etaMinutes ?? null
  const previewSeverityTone =
    previewRoute?.severity === 'low'
      ? 'border-emerald-400/18 bg-emerald-400/10 text-emerald-100'
      : previewRoute?.severity === 'medium'
        ? 'border-amber-400/18 bg-amber-400/10 text-amber-100'
        : previewRoute?.severity === 'high'
          ? 'border-rose-400/18 bg-rose-400/10 text-rose-100'
          : null

  return (
    <Card className="h-fit overflow-hidden xl:sticky xl:top-5">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              {currentStop ? `Entrega ${currentStop.orderNumber}` : 'Motoboy selecionado'}
            </p>
            <h3 className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">
              {currentStop ? currentStop.customerName : driver.name}
            </h3>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <DriverStatusPill driver={driver} />
            {order ? <StatusBadge channel={order.source} /> : null}
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <MapPinned className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Destino</p>
              <p className="mt-1 text-lg font-black text-white">{destinationLabel}</p>
              {currentStop ? (
                <p className="mt-1 text-sm text-slate-400">
                  Parada {currentStop.finalSequence} da rota · {currentStop.addressLabel}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Aguardando atribuicao de entrega ativa.</p>
              )}
            </div>
          </div>
        </div>

        {previewRoute ? (
          <div className={cn('mt-4 rounded-[22px] border px-4 py-3', previewSeverityTone)}>
            <p className="text-xs font-black uppercase tracking-[0.16em]">Prévia ativa</p>
            <p className="mt-2 text-sm">
              +{previewRoute.addedEtaMinutes} min | {formatDistanceMeters(previewRoute.addedDistanceMeters)} | score {previewRoute.routeCompatibilityScore}/100
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard icon={<Clock3 className="h-4 w-4" />} label="ETA" value={formatEtaMinutes(routeEta)} />
          <MetricCard
            icon={<Route className="h-4 w-4" />}
            label="Distancia restante"
            value={formatDistanceMeters(routeDistance)}
          />
          <MetricCard
            icon={<MoveRight className="h-4 w-4" />}
            label="Velocidade"
            value={formatSpeedKmh(location?.speedKmh)}
          />
        </div>

        <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-black text-white">
                {driver.name
                  .split(' ')
                  .slice(0, 2)
                  .map((chunk) => chunk[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div>
                <p className="font-black text-white">{driver.name}</p>
                <p className="text-sm text-slate-400">{driver.phone}</p>
              </div>
            </div>
            <Button asChild variant="outline" size="icon">
              <a href={`tel:${driver.phone}`} aria-label={`Ligar para ${driver.name}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>{driver.vehicle}</span>
            <span className="h-1 w-1 rounded-full bg-slate-600" />
            <span>
              {routeLoading
                ? 'Recalculando rota...'
                : realtimeConnected
                  ? 'Acompanhamento conectado'
                  : 'Acompanhamento usando a ultima posicao'}
            </span>
            {location ? (
              <>
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span>Atualizado {formatRelative(location.capturedAt)}</span>
              </>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 h-9 rounded-2xl"
            onClick={onOpenDispatchCenter}
          >
            Ver pedidos prontos
          </Button>
        </section>

        {order ? (
          <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Package2 className="h-4 w-4 text-primary" />
              <p className="font-black text-white">Pedido</p>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Canal</span>
                <span>{channelLabelMap[order.source]}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Pagamento</span>
                <span>{paymentLabelMap[order.paymentMethod]}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Total</span>
                <span className="font-black text-white">{formatCompactCurrency(order.total)}</span>
              </div>
              {order.notes ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-slate-400">
                  {order.notes}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Route className="h-4 w-4 text-sky-300" />
            <p className="font-black text-white">Rota / Paradas</p>
          </div>

          <div className="space-y-3">
            <StopRow
              index={1}
              title="Origem"
              description={driverMapStoreLabel}
              trailing="Pronto"
              completed
            />
            {currentStop ? (
              <StopRow
                index={2}
                title="Entrega atual"
                description={currentStop.addressLabel}
                trailing={`${formatEtaMinutes(currentStop.etaMinutes)} · ${formatDistanceMeters(currentStop.distanceMeters)}`}
                active
              />
            ) : null}
            {nextStop ? (
              <StopRow
                index={3}
                title="Proxima parada"
                description={nextStop.addressLabel}
                trailing={`${formatEtaMinutes(nextStop.etaMinutes)} · ${formatDistanceMeters(nextStop.distanceMeters)}`}
              />
            ) : null}
          </div>
        </section>

        {devControls ? (
          <section className="rounded-[22px] border border-dashed border-white/12 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <TimerReset className="h-4 w-4 text-primary" />
              Ferramentas dev
            </div>
            <div className="flex flex-wrap gap-2">{devControls}</div>
          </section>
        ) : null}

        {currentStop?.orderId ? (
          <Button asChild className="w-full">
            <Link to={`/orders/${currentStop.orderId}`}>
              Ver pedido completo
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function StopRow({
  index,
  title,
  description,
  trailing,
  active = false,
  completed = false,
}: {
  index: number
  title: string
  description: string
  trailing: string
  active?: boolean
  completed?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span
          className={[
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-black',
            active
              ? 'bg-sky-400/18 text-sky-200 ring-1 ring-sky-300/25'
              : completed
                ? 'bg-emerald-400/18 text-emerald-200 ring-1 ring-emerald-300/25'
                : 'bg-white/[0.06] text-slate-300 ring-1 ring-white/10',
          ].join(' ')}
        >
          {index}
        </span>
        {!completed ? <span className="mt-1 h-full min-h-6 w-px bg-white/10" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <span className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          {trailing}
        </span>
      </div>
    </div>
  )
}

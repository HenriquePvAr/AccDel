import {
  Bike,
  CheckCircle2,
  Clipboard,
  Clock3,
  CreditCard,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  ReceiptText,
  UserRound,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { channelLabelMap, paymentLabelMap } from '@/lib/domain'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order, TimelineEntry } from '@/types'

import { type OrderAction } from './order-actions'
import { orderStatusUi } from './order-ui'

type DrawerAction =
  | {
      type: 'mutation'
      action: OrderAction
      label: string
      variant: 'primary' | 'secondary' | 'danger'
    }
  | {
      type: 'track'
      label: string
      variant: 'secondary'
    }

interface OrderDrawerProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (orderId: string, action: OrderAction) => void
  onTrackDelivery?: (order: Order) => void
  canUpdate?: boolean
  busy?: boolean
}

const paymentStatusLabel: Record<Order['paymentStatus'], string> = {
  paid: 'Pago',
  pending: 'Pendente',
  failed: 'Falhou',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
}

export function OrderDrawer({
  order,
  open,
  onOpenChange,
  onAction,
  onTrackDelivery,
  canUpdate = true,
  busy = false,
}: OrderDrawerProps) {
  if (!order) {
    return null
  }

  const statusUi = orderStatusUi[order.status]
  const address = order.addressText ?? order.addressLabel ?? order.tableCode ?? ''
  const actions = getDrawerActions(order)

  const handlePhone = () => {
    const phone = sanitizePhone(order.customerPhone)

    if (!phone) {
      return
    }

    window.location.href = `tel:${phone}`
  }

  const handleWhatsApp = () => {
    const phone = sanitizePhone(order.customerPhone)

    if (!phone) {
      return
    }

    window.open(`https://wa.me/55${phone}`, '_blank', 'noopener,noreferrer')
  }

  const handleCopyAddress = () => {
    if (!address || !navigator.clipboard) {
      return
    }

    void navigator.clipboard.writeText(address)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-[520px] gap-0 overflow-hidden bg-background p-0 text-foreground max-sm:border-l-0">
        <SheetHeader className="border-b border-border py-5 pl-5 pr-20 sm:pr-14">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                    statusUi.badgeClass,
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {statusUi.label}
                </span>
              </div>
              <SheetTitle className="text-xl">Pedido {order.number}</SheetTitle>
              <SheetDescription className="mt-1">
                {channelLabelMap[order.source]} · recebido em {formatDateTime(order.createdAt)}
              </SheetDescription>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-mono text-base font-semibold text-foreground sm:text-lg">
                {formatCurrency(order.total)}
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 scrollbar-thin">
          <DrawerSection title="Cliente">
            <div className="grid gap-3 text-sm">
              <InfoRow icon={UserRound} label="Nome" value={order.customerName} />
              <InfoRow icon={Phone} label="Telefone" value={order.customerPhone || 'Nao informado'} />
              <InfoRow
                icon={MapPin}
                label={order.source === 'delivery' ? 'Endereco' : 'Origem'}
                value={address || channelLabelMap[order.source]}
              />
              <InfoRow icon={Package} label="Tipo do pedido" value={channelLabelMap[order.source]} />
              <InfoRow
                icon={CreditCard}
                label="Pagamento"
                value={`${paymentLabelMap[order.paymentMethod]} · ${paymentStatusLabel[order.paymentStatus]}`}
              />
              <InfoRow icon={Clock3} label="Horario" value={formatDateTime(order.createdAt)} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 px-2"
                onClick={handleWhatsApp}
                disabled={!sanitizePhone(order.customerPhone)}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 px-2"
                onClick={handlePhone}
                disabled={!sanitizePhone(order.customerPhone)}
              >
                <Phone className="h-4 w-4" />
                Ligar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 px-2"
                onClick={handleCopyAddress}
                disabled={!address}
              >
                <Clipboard className="h-4 w-4" />
                Endereco
              </Button>
            </div>
          </DrawerSection>

          <DrawerSection title="Itens do pedido">
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-muted/45 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {item.quantity}x {item.name}
                      </p>
                      {item.options.length ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.options
                            .map((option) =>
                              option.quantity > 1 ? `${option.quantity}x ${option.name}` : option.name,
                            )
                            .join(', ')}
                        </p>
                      ) : null}
                      {item.notes ? (
                        <p className="mt-1 text-xs text-amber-800">{item.notes}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-sm text-foreground">
                      {formatCurrency(getItemTotal(item))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <TotalRow label="Subtotal" value={order.subtotal} />
              <TotalRow label="Taxa de entrega" value={order.deliveryFee} />
              {order.discount > 0 ? <TotalRow label="Desconto" value={-order.discount} /> : null}
              <TotalRow label="Total" value={order.total} strong />
            </div>
          </DrawerSection>

          {order.notes ? (
            <DrawerSection title="Observacao">
              <p className="text-sm leading-6 text-foreground">{order.notes}</p>
            </DrawerSection>
          ) : null}

          <DrawerSection title="Linha do tempo">
            <div className="space-y-3">
              {buildOperationalTimeline(order).map((step, index) => (
                <div key={`${step.label}-${index}`} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full ring-4',
                      step.at
                        ? 'bg-sky-600 ring-sky-100'
                        : 'bg-slate-300 ring-slate-100',
                    )}
                  />
                  <span className="min-w-0 flex-1 text-foreground">{step.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {step.at ? formatDateTime(step.at) : '-'}
                  </span>
                </div>
              ))}
            </div>
          </DrawerSection>
        </div>

        {actions.length ? (
          <div className="grid grid-cols-2 gap-3 border-t border-border bg-background/95 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 sm:px-5">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant={getButtonVariant(action)}
                className={cn(
                  'h-12',
                  actions.length === 1 ? 'col-span-2' : null,
                  getDrawerActionClass(action),
                )}
                disabled={isActionDisabled(action, canUpdate, busy)}
                onClick={() => {
                  if (action.type === 'track') {
                    onTrackDelivery?.(order)
                    return
                  }

                  onAction(order.id, action.action)
                }}
              >
                {getActionIcon(action)}
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function DrawerSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-muted/35 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="grid grid-cols-[18px_96px_minmax(0,1fr)] items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{value}</span>
    </div>
  )
}

function TotalRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        strong ? 'text-base font-semibold text-foreground' : null,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{formatCurrency(value)}</span>
    </div>
  )
}

function getDrawerActions(order: Order): DrawerAction[] {
  switch (order.status) {
    case 'in_analysis':
      return [
        { type: 'mutation', action: 'cancel', label: 'Recusar', variant: 'secondary' },
        { type: 'mutation', action: 'accept', label: 'Aceitar pedido', variant: 'primary' },
      ]
    case 'in_preparation':
      return [
        { type: 'mutation', action: 'cancel', label: 'Cancelar', variant: 'secondary' },
        { type: 'mutation', action: 'ready', label: 'Marcar como pronto', variant: 'primary' },
      ]
    case 'ready':
      return [
        {
          type: 'mutation',
          action: order.source === 'delivery' ? 'dispatch' : 'complete',
          label: order.source === 'delivery' ? 'Despachar' : 'Finalizar pedido',
          variant: 'primary',
        },
      ]
    case 'out_for_delivery':
      return [
        { type: 'track', label: 'Acompanhar entrega', variant: 'secondary' },
        { type: 'mutation', action: 'complete', label: 'Finalizar pedido', variant: 'primary' },
      ]
    default:
      return []
  }
}

function getButtonVariant(action: DrawerAction): 'default' | 'outline' | 'danger' {
  if (action.variant === 'primary') {
    return 'default'
  }

  if (action.variant === 'danger') {
    return 'danger'
  }

  return 'outline'
}

function getDrawerActionClass(action: DrawerAction) {
  if (action.type === 'track') {
    return 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
  }

  if (action.action === 'accept') {
    return 'border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700'
  }

  if (action.action === 'ready') {
    return 'border-primary bg-primary text-white hover:border-[#e94a22] hover:bg-[#e94a22]'
  }

  if (action.action === 'dispatch' || action.action === 'complete') {
    return 'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700'
  }

  return ''
}

function isActionDisabled(action: DrawerAction, canUpdate: boolean, busy: boolean) {
  if (action.type === 'track') {
    return busy
  }

  return !canUpdate || busy
}

function getActionIcon(action: DrawerAction) {
  if (action.type === 'track') {
    return <Bike className="h-4 w-4" />
  }

  if (action.action === 'cancel') {
    return <XCircle className="h-4 w-4" />
  }

  if (action.action === 'ready' || action.action === 'complete') {
    return <CheckCircle2 className="h-4 w-4" />
  }

  if (action.action === 'dispatch') {
    return <Bike className="h-4 w-4" />
  }

  return <ReceiptText className="h-4 w-4" />
}

function getItemTotal(item: Order['items'][number]) {
  const optionsTotal = item.options.reduce(
    (total, option) => total + option.price * option.quantity,
    0,
  )

  return (item.unitPrice + optionsTotal) * item.quantity
}

function buildOperationalTimeline(order: Order) {
  const received = order.timeline[0]?.at ?? order.createdAt

  return [
    { label: 'Pedido recebido', at: received },
    { label: 'Pedido aceito', at: findTimelineEntry(order.timeline, ['aceito', 'accepted'])?.at },
    {
      label: 'Enviado para preparo',
      at: findTimelineEntry(order.timeline, ['preparo', 'producao', 'production'])?.at,
    },
    { label: 'Pedido pronto', at: findTimelineEntry(order.timeline, ['pronto', 'ready'])?.at },
    {
      label: 'Saiu para entrega',
      at: findTimelineEntry(order.timeline, ['rota', 'despach', 'entrega', 'delivery'])?.at,
    },
    {
      label: 'Pedido finalizado',
      at: findTimelineEntry(order.timeline, ['finalizado', 'concluido', 'completed'])?.at,
    },
  ]
}

function findTimelineEntry(timeline: TimelineEntry[], terms: string[]) {
  return timeline.find((entry) => {
    const label = normalizeText(entry.label)
    return terms.some((term) => label.includes(term))
  })
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function sanitizePhone(value: string) {
  return value.replace(/\D/g, '')
}

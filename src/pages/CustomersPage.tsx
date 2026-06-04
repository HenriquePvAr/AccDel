import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, MapPin, Phone, Search, ShoppingCart, TrendingUp, UserRound } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { PageShell } from '@/components/shared/PageShell'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { CustomerAddressPayload } from '@/contracts'
import {
  useCustomerByIdQuery,
  useCustomersQuery,
  useUpdateCustomerMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Customer } from '@/types'

type CustomerDraft = {
  name: string
  phone: string
  notes: string
  address: CustomerAddressPayload
}

function buildDraft(customer: Customer): CustomerDraft {
  const address = customer.addresses[0]

  return {
    name: customer.name,
    phone: customer.phone,
    notes: customer.notes ?? '',
    address: {
      label: address?.label ?? 'Principal',
      street: address?.street ?? '',
      number: address?.number ?? '',
      district: address?.district ?? '',
      complement: address?.complement ?? '',
      city: address?.city ?? 'Manaus',
      state: address?.state ?? 'AM',
      reference: address?.reference ?? '',
    },
  }
}

export function CustomersPage() {
  usePageTitle('Clientes')
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const customersQuery = useCustomersQuery({ filters: { q: debouncedSearch, pageSize: 50 } })
  const selectedCustomerQuery = useCustomerByIdQuery(selectedCustomerId)
  const updateCustomer = useUpdateCustomerMutation()
  const customers = customersQuery.data?.data ?? []
  const selectedCustomer =
    selectedCustomerQuery.data?.data ??
    customers.find((customer) => customer.id === selectedCustomerId) ??
    null

  const totalOrders = customers.reduce(
    (sum, customer) => sum + (customer.crm?.orderCount ?? customer.lastOrders?.length ?? 0),
    0,
  )
  const visibleRevenue = customers.reduce(
    (sum, customer) =>
      sum +
      (customer.crm?.totalSpent ??
        customer.lastOrders?.reduce((orderSum, order) => orderSum + order.total, 0) ??
        0),
    0,
  )
  const vipCustomers = customers.filter((customer) => customer.crm?.segment === 'vip').length

  return (
    <PageShell>
      <SectionHeader
        title="Clientes"
        description="Busca por nome ou WhatsApp, historico recente e edicao rapida com API real."
        actions={
          <Button onClick={() => navigate('/orders/new')}>
            <ShoppingCart className="h-4 w-4" />
            Novo pedido
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CustomerStat label="Clientes visiveis" value={String(customers.length)} />
        <CustomerStat label="Pedidos reais" value={String(totalOrders)} />
        <CustomerStat label="Gasto total" value={formatCurrency(visibleRevenue)} />
        <CustomerStat label="Clientes VIP" value={String(vipCustomers)} />
      </div>

      <Card>
        <CardContent className="p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente por nome ou WhatsApp"
              className="pl-9"
            />
          </label>
        </CardContent>
      </Card>

      {customersQuery.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[180px] rounded-[24px]" />
          ))}
        </div>
      ) : customersQuery.isError ? (
        <EmptyState
          icon={<UserRound className="h-5 w-5" />}
          title="Falha ao carregar clientes"
          description="A API nao retornou a base de clientes agora."
        />
      ) : customers.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onOpen={() => setSelectedCustomerId(customer.id)}
              onOrder={() => navigate('/orders/new')}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<UserRound className="h-5 w-5" />}
          title="Nenhum cliente encontrado"
          description="A busca usa o endpoint real de clientes e aceita nome ou WhatsApp."
        />
      )}

      <CustomerDrawer
        key={selectedCustomer?.id ?? 'closed'}
        customer={selectedCustomer}
        busy={updateCustomer.isPending}
        open={Boolean(selectedCustomerId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCustomerId(null)
          }
        }}
        onSave={(draft) => {
          if (!selectedCustomer) {
            return
          }

          updateCustomer.mutate({
            customerId: selectedCustomer.id,
            name: draft.name,
            phone: draft.phone,
            notes: draft.notes,
            address: draft.address,
          })
        }}
        onNewOrder={() => navigate('/orders/new')}
      />
    </PageShell>
  )
}

function CustomerCard({
  customer,
  onOpen,
  onOrder,
}: {
  customer: Customer
  onOpen: () => void
  onOrder: () => void
}) {
  const address = customer.addresses[0]
  const lastOrder = customer.lastOrders?.[0]
  const crm = customer.crm
  const segment = crm ? crmSegmentCopy[crm.segment] : null

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{customer.name}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              {customer.phone}
            </p>
          </div>
          {segment ? (
            <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${segment.className}`}>
              {segment.label}
            </span>
          ) : (
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
              CRM indisponivel
            </span>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <CustomerMiniMetric
            label="Pedidos"
            value={String(crm?.orderCount ?? customer.lastOrders?.length ?? 0)}
          />
          <CustomerMiniMetric
            label="Gasto"
            value={crm ? formatCurrency(crm.totalSpent) : 'Indisponivel'}
          />
          <CustomerMiniMetric
            label="Ticket"
            value={crm ? formatCurrency(crm.averageTicket) : 'Indisponivel'}
          />
        </div>

        <div className="rounded-2xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
          <p className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {address ? `${address.street}, ${address.number} - ${address.district}` : 'Sem endereco cadastrado'}
          </p>
          {lastOrder ? (
            <p className="mt-2 text-slate-300">
              Ultimo pedido {lastOrder.number}: {formatCurrency(lastOrder.total)} em{' '}
              {formatDateTime(lastOrder.createdAt)}
            </p>
          ) : null}
          {crm?.favoriteItems.length ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-emerald-200">
              <TrendingUp className="h-3.5 w-3.5" />
              Prefere: {crm.favoriteItems.join(', ')}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onOpen}>
            Ver / editar
          </Button>
          <Button variant="outline" className="flex-1" onClick={onOrder}>
            Novo pedido
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CustomerDrawer({
  customer,
  busy,
  open,
  onOpenChange,
  onSave,
  onNewOrder,
}: {
  customer: Customer | null
  busy: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (draft: CustomerDraft) => void
  onNewOrder: () => void
}) {
  const [draft, setDraft] = useState<CustomerDraft | null>(() =>
    customer ? buildDraft(customer) : null,
  )

  if (!customer || !draft) {
    return null
  }

  const totalSpent =
    customer.crm?.totalSpent ??
    customer.lastOrders?.reduce((sum, order) => sum + order.total, 0) ??
    0
  const averageTicket =
    customer.crm?.averageTicket ??
    (customer.lastOrders?.length ? totalSpent / customer.lastOrders.length : 0)
  const segment = customer.crm ? crmSegmentCopy[customer.crm.segment] : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[760px] overflow-y-auto">
        <SheetHeader className="pr-10">
          <SheetTitle>{customer.name}</SheetTitle>
          <SheetDescription>Cadastro, endereco e historico recente do cliente.</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="font-semibold text-slate-100">Dados do cliente</h3>
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Nome"
                />
                <Input
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  placeholder="WhatsApp"
                />
                <Input
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="Observacao interna"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="font-semibold text-slate-100">Endereco principal</h3>
                <div className="grid gap-3 md:grid-cols-[1fr_100px]">
                  <Input
                    value={draft.address.street}
                    onChange={(event) =>
                      setDraft({ ...draft, address: { ...draft.address, street: event.target.value } })
                    }
                    placeholder="Rua"
                  />
                  <Input
                    value={draft.address.number}
                    onChange={(event) =>
                      setDraft({ ...draft, address: { ...draft.address, number: event.target.value } })
                    }
                    placeholder="Numero"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={draft.address.district}
                    onChange={(event) =>
                      setDraft({ ...draft, address: { ...draft.address, district: event.target.value } })
                    }
                    placeholder="Bairro"
                  />
                  <Input
                    value={draft.address.city}
                    onChange={(event) =>
                      setDraft({ ...draft, address: { ...draft.address, city: event.target.value } })
                    }
                    placeholder="Cidade"
                  />
                </div>
                <Input
                  value={draft.address.complement ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, address: { ...draft.address, complement: event.target.value } })
                  }
                  placeholder="Complemento"
                />
                <Input
                  value={draft.address.reference ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, address: { ...draft.address, reference: event.target.value } })
                  }
                  placeholder="Referencia"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="font-semibold text-slate-100">Historico recente</h3>
                {customer.lastOrders?.length ? (
                  customer.lastOrders.map((order) => (
                    <div key={order.id} className="rounded-2xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-100">{order.number}</p>
                        <span className="font-mono text-orange-200">{formatCurrency(order.total)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{order.items.join(', ')}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum pedido recente retornado pela API.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-semibold text-slate-100">Resumo</p>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryLine label="Segmento" value={segment?.label ?? 'Indisponivel'} />
              <SummaryLine
                label="Pedidos reais"
                value={String(customer.crm?.orderCount ?? customer.lastOrders?.length ?? 0)}
              />
              <SummaryLine
                label="Concluidos"
                value={String(customer.crm?.completedOrders ?? 'Indisponivel')}
              />
              <SummaryLine
                label="Cancelamentos"
                value={String(customer.crm?.cancelledOrders ?? 'Indisponivel')}
              />
              <SummaryLine label="Gasto total" value={formatCurrency(totalSpent)} />
              <SummaryLine label="Ticket medio" value={formatCurrency(averageTicket)} />
              <SummaryLine
                label="Frequencia"
                value={formatFrequency(customer.crm?.frequencyDays)}
              />
              <SummaryLine
                label="Ultimo pedido"
                value={customer.crm?.lastOrderAt ? formatDateTime(customer.crm.lastOrderAt) : 'Sem historico'}
              />
              <SummaryLine label="Enderecos" value={String(customer.addresses.length)} />
            </div>
            {customer.crm?.favoriteItems.length ? (
              <div className="mt-4 rounded-2xl bg-emerald-400/10 p-3 text-sm text-emerald-100 ring-1 ring-emerald-300/20">
                <p className="flex items-center gap-2 font-black">
                  <Crown className="h-4 w-4" />
                  Preferencias reais
                </p>
                <p className="mt-1 text-xs text-emerald-100/80">
                  {customer.crm.favoriteItems.join(', ')}
                </p>
              </div>
            ) : null}
            <div className="mt-5 space-y-2">
              <Button className="w-full" disabled={busy} onClick={() => onSave(draft)}>
                {busy ? 'Salvando...' : 'Salvar cliente'}
              </Button>
              <Button variant="secondary" className="w-full" onClick={onNewOrder}>
                Criar pedido
              </Button>
            </div>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CustomerStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-mono text-3xl font-semibold text-slate-100">{value}</p>
      </CardContent>
    </Card>
  )
}

function CustomerMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.035] p-3 ring-1 ring-white/10">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-sm font-black text-slate-100">{value}</p>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-slate-100">{value}</p>
    </div>
  )
}

const crmSegmentCopy = {
  new: {
    label: 'Cliente novo',
    className: 'bg-blue-400/10 text-blue-200 ring-blue-300/20',
  },
  recurring: {
    label: 'Recorrente',
    className: 'bg-emerald-400/10 text-emerald-200 ring-emerald-300/20',
  },
  vip: {
    label: 'VIP',
    className: 'bg-amber-400/10 text-amber-200 ring-amber-300/20',
  },
  inactive: {
    label: 'Inativo',
    className: 'bg-slate-400/10 text-slate-200 ring-slate-300/20',
  },
} as const

function formatFrequency(days: number | null | undefined) {
  if (!days) {
    return 'Sem recorrencia suficiente'
  }

  return `A cada ${days} dia(s)`
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, value])

  return debouncedValue
}

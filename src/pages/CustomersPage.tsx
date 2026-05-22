import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Phone, Search, ShoppingCart, UserRound } from 'lucide-react'

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

  const totalOrders = customers.reduce((sum, customer) => sum + (customer.lastOrders?.length ?? 0), 0)
  const visibleRevenue = customers.reduce(
    (sum, customer) =>
      sum + (customer.lastOrders?.reduce((orderSum, order) => orderSum + order.total, 0) ?? 0),
    0,
  )

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

      <div className="grid gap-4 md:grid-cols-3">
        <CustomerStat label="Clientes visiveis" value={String(customers.length)} />
        <CustomerStat label="Pedidos recentes" value={String(totalOrders)} />
        <CustomerStat label="Receita recente" value={formatCurrency(visibleRevenue)} />
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
          <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
            {customer.lastOrders?.length ?? 0} pedido(s)
          </span>
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

  const totalSpent = customer.lastOrders?.reduce((sum, order) => sum + order.total, 0) ?? 0
  const averageTicket = customer.lastOrders?.length ? totalSpent / customer.lastOrders.length : 0

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
              <SummaryLine label="Pedidos recentes" value={String(customer.lastOrders?.length ?? 0)} />
              <SummaryLine label="Total recente" value={formatCurrency(totalSpent)} />
              <SummaryLine label="Ticket medio" value={formatCurrency(averageTicket)} />
              <SummaryLine label="Enderecos" value={String(customer.addresses.length)} />
            </div>
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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-slate-100">{value}</p>
    </div>
  )
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, value])

  return debouncedValue
}
